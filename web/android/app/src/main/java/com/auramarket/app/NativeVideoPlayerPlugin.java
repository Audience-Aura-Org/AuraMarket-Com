package com.auradime.app;

import android.graphics.Color;
import android.graphics.SurfaceTexture;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageButton;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NativeVideoPlayerPlugin
 *
 * Renders video using ExoPlayer on a TextureView — same tech stack as WhatsApp.
 * Supports two modes:
 *
 *   viewerMode = false  (creator / default)
 *     TextureView is added to the DecorView ABOVE the WebView.
 *     A native play/pause ImageButton sits above the TextureView so it is
 *     always visible and tappable (WebView buttons would be hidden behind it).
 *
 *   viewerMode = true  (story viewer)
 *     TextureView is added BEHIND the WebView (index 0 in android.R.id.content).
 *     WebView background is made transparent so the video shows through.
 *     All WebView controls (progress bars, mute, close, etc.) render on top
 *     and remain fully interactive — identical to the "camera preview" pattern.
 *
 * Trim loop: a 100 ms Handler poll seeks back to trimStartMs when
 * position >= trimEndMs - 250 ms.
 */
@UnstableApi
@CapacitorPlugin(name = "NativeVideoPlayer")
public class NativeVideoPlayerPlugin extends Plugin {

    private ExoPlayer player;
    private FrameLayout container;
    private TextureView textureView;
    private ImageButton playPauseBtn;   // creator mode only

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable timeUpdateTask;
    private boolean isReleased    = true;
    private boolean isViewerMode  = false;

    private long trimStartMs = 0;
    private long trimEndMs   = Long.MAX_VALUE;

    // ── create ───────────────────────────────────────────────────────────────
    @PluginMethod
    public void create(PluginCall call) {
        final int     x          = call.getInt("x",          0);
        final int     y          = call.getInt("y",          0);
        final int     width      = call.getInt("width",      0);
        final int     height     = call.getInt("height",     0);
        final boolean muted      = Boolean.TRUE.equals(call.getBoolean("muted",      true));
        final boolean viewerMode = Boolean.TRUE.equals(call.getBoolean("viewerMode", false));

        call.setKeepAlive(true);

        mainHandler.post(() -> {
            releaseInternal();  // destroy any previously active player

            isViewerMode = viewerMode;

            // Container (black background while first frame loads)
            container = new FrameLayout(getContext());
            container.setBackgroundColor(Color.BLACK);

            // TextureView — ExoPlayer renders into this surface
            textureView = new TextureView(getContext());
            FrameLayout.LayoutParams tvLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            );
            container.addView(textureView, tvLp);

            // Position overlay (JS sends physical pixels: cssRect × devicePixelRatio)
            int[] wvLoc = new int[2];
            getBridge().getWebView().getLocationOnScreen(wvLoc);
            int screenX = wvLoc[0] + x;
            int screenY = wvLoc[1] + y;
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(width, height);
            lp.leftMargin = screenX;
            lp.topMargin  = screenY;

            if (viewerMode) {
                // ── Viewer mode: add BEHIND WebView ──────────────────────────
                // android.R.id.content is the FrameLayout that holds the WebView.
                // Adding our container at index 0 places it below the WebView.
                FrameLayout contentFrame = getActivity().findViewById(android.R.id.content);
                contentFrame.addView(container, 0, lp);

                // Make WebView background transparent so the video shows through
                // wherever the WebView HTML has a transparent/no-background element.
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
                getBridge().getWebView().getRootView().setBackgroundColor(Color.TRANSPARENT);

                // No native play/pause button — WebView controls are on top and visible.

            } else {
                // ── Creator mode: add ABOVE WebView (existing behaviour) ──────
                ViewGroup decorView = (ViewGroup) getActivity().getWindow().getDecorView();
                decorView.addView(container, lp);

                // Native play/pause button sits above the TextureView (WhatsApp-style).
                // WebView buttons would be hidden behind the overlay, so we add a
                // native button that is always visible.
                ImageButton btn = new ImageButton(getContext());
                int btnSize = dpToPx(56);
                FrameLayout.LayoutParams btnLp =
                    new FrameLayout.LayoutParams(btnSize, btnSize, Gravity.CENTER);
                GradientDrawable btnBg = new GradientDrawable();
                btnBg.setShape(GradientDrawable.OVAL);
                btnBg.setColor(Color.argb(160, 0, 0, 0));
                btn.setBackground(btnBg);
                btn.setImageResource(android.R.drawable.ic_media_pause); // starts playing
                btn.setColorFilter(Color.WHITE);
                btn.setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14));
                btn.setOnClickListener(v -> {
                    if (player == null || isReleased) return;
                    if (player.isPlaying()) player.pause(); else player.play();
                });
                container.addView(btn, btnLp);
                playPauseBtn = btn;
            }

            // Build ExoPlayer
            player = new ExoPlayer.Builder(getContext()).build();
            player.setVideoTextureView(textureView);
            player.setVolume(muted ? 0f : 1f);
            // Cover mode — fills container, crops if aspect ratio differs
            player.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);

            player.addListener(new Player.Listener() {
                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
                    // Update native button icon (creator mode only)
                    if (playPauseBtn != null) {
                        playPauseBtn.setImageResource(isPlaying
                            ? android.R.drawable.ic_media_pause
                            : android.R.drawable.ic_media_play);
                    }
                    JSObject d = new JSObject();
                    d.put("playing", isPlaying);
                    notifyListeners("stateChange", d, true);
                }

                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        long dur = player.getDuration();
                        if (dur > 0) {
                            JSObject d = new JSObject();
                            d.put("duration", dur / 1000.0);
                            notifyListeners("durationUpdate", d, true);
                        }
                    }
                }

                @Override
                public void onPlayerError(androidx.media3.common.PlaybackException error) {
                    JSObject d = new JSObject();
                    d.put("message", error.getMessage());
                    notifyListeners("error", d, true);
                }
            });

            isReleased = false;
            startTimeUpdateLoop();
            call.resolve();
        });
    }

    // ── setSource ────────────────────────────────────────────────────────────
    @PluginMethod
    public void setSource(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("uri required"); return; }

        mainHandler.post(() -> {
            if (player == null || isReleased) { call.reject("player not created"); return; }
            MediaItem item = MediaItem.fromUri(uriStr);
            player.setMediaItem(item);
            player.setRepeatMode(Player.REPEAT_MODE_OFF); // loop handled manually
            player.prepare();
            call.resolve();
        });
    }

    // ── play ─────────────────────────────────────────────────────────────────
    @PluginMethod
    public void play(PluginCall call) {
        mainHandler.post(() -> {
            if (player != null && !isReleased) player.play();
            call.resolve();
        });
    }

    // ── pause ────────────────────────────────────────────────────────────────
    @PluginMethod
    public void pause(PluginCall call) {
        mainHandler.post(() -> {
            if (player != null && !isReleased) player.pause();
            call.resolve();
        });
    }

    // ── seek ─────────────────────────────────────────────────────────────────
    @PluginMethod
    public void seek(PluginCall call) {
        long timeMs = call.getLong("timeMs", 0L);
        mainHandler.post(() -> {
            if (player == null || isReleased) { call.resolve(); return; }
            long clamped = Math.max(trimStartMs, Math.min(timeMs, trimEndMs));
            player.seekTo(clamped);
            call.resolve();
        });
    }

    // ── setMuted ─────────────────────────────────────────────────────────────
    @PluginMethod
    public void setMuted(PluginCall call) {
        boolean muted = Boolean.TRUE.equals(call.getBoolean("muted", true));
        mainHandler.post(() -> {
            if (player != null && !isReleased) player.setVolume(muted ? 0f : 1f);
            call.resolve();
        });
    }

    // ── setTrimRange ─────────────────────────────────────────────────────────
    @PluginMethod
    public void setTrimRange(PluginCall call) {
        long startMs = call.getLong("startMs", 0L);
        long endMs   = call.getLong("endMs",   Long.MAX_VALUE);
        trimStartMs  = Math.max(0, startMs);
        trimEndMs    = endMs > 0 ? endMs : Long.MAX_VALUE;
        call.resolve();
    }

    // ── updateBounds ─────────────────────────────────────────────────────────
    @PluginMethod
    public void updateBounds(PluginCall call) {
        final int x      = call.getInt("x",      0);
        final int y      = call.getInt("y",      0);
        final int width  = call.getInt("width",  0);
        final int height = call.getInt("height", 0);

        mainHandler.post(() -> {
            if (container == null) { call.resolve(); return; }
            int[] wvLoc = new int[2];
            getBridge().getWebView().getLocationOnScreen(wvLoc);

            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) container.getLayoutParams();
            lp.leftMargin = wvLoc[0] + x;
            lp.topMargin  = wvLoc[1] + y;
            lp.width      = width;
            lp.height     = height;
            container.setLayoutParams(lp);
            call.resolve();
        });
    }

    // ── destroy ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void destroy(PluginCall call) {
        mainHandler.post(() -> {
            releaseInternal();
            call.resolve();
        });
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private void releaseInternal() {
        isReleased   = true;
        playPauseBtn = null;

        if (timeUpdateTask != null) {
            mainHandler.removeCallbacks(timeUpdateTask);
            timeUpdateTask = null;
        }

        if (player != null) {
            try { player.stop();    } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }

        if (container != null) {
            try {
                ViewGroup parent = (ViewGroup) container.getParent();
                if (parent != null) parent.removeView(container);
            } catch (Exception ignored) {}
            container    = null;
            textureView  = null;
        }

        // Restore WebView background if we made it transparent (viewer mode)
        if (isViewerMode) {
            try {
                getBridge().getWebView().setBackgroundColor(Color.BLACK);
                getBridge().getWebView().getRootView().setBackgroundColor(Color.BLACK);
            } catch (Exception ignored) {}
            isViewerMode = false;
        }
    }

    private void startTimeUpdateLoop() {
        timeUpdateTask = new Runnable() {
            @Override
            public void run() {
                if (isReleased || player == null) return;

                long pos = player.getCurrentPosition();

                // Trim-range loop: seek back to start when end is reached.
                if (player.isPlaying() && trimEndMs < Long.MAX_VALUE && pos >= trimEndMs - 250) {
                    player.seekTo(trimStartMs);
                    pos = trimStartMs;
                }

                JSObject d = new JSObject();
                d.put("currentTime", pos / 1000.0);
                notifyListeners("timeUpdate", d, true);

                mainHandler.postDelayed(this, 100);
            }
        };
        mainHandler.postDelayed(timeUpdateTask, 100);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getContext().getResources().getDisplayMetrics().density);
    }
}
