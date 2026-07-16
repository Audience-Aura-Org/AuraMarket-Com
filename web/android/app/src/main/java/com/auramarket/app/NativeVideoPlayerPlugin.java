package com.auradime.app;

import android.graphics.Color;
import android.graphics.SurfaceTexture;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

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
 * Renders video using ExoPlayer on a TextureView overlaid directly on the
 * Activity's DecorView — identical to how WhatsApp renders video previews.
 * No WebView compositor overhead; full hardware-accelerated decode.
 *
 * Lifecycle (called from StatusCreator.js):
 *   create()    → overlay TextureView at given screen rect
 *   setSource() → load content:// URI, prepare ExoPlayer
 *   play/pause/seek/setMuted/setTrimRange/updateBounds
 *   destroy()   → release player, remove view
 *
 * Trim loop: a 100 ms Handler poll seeks back to trimStartMs when
 * position >= trimEndMs - 250 ms (mirrors the WebView timeupdate approach,
 * but without any media reload on trim-handle drag).
 */
@UnstableApi
@CapacitorPlugin(name = "NativeVideoPlayer")
public class NativeVideoPlayerPlugin extends Plugin {

    private ExoPlayer player;
    private FrameLayout container;
    private TextureView textureView;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable timeUpdateTask;
    private boolean isReleased = true;

    private long trimStartMs = 0;
    private long trimEndMs   = Long.MAX_VALUE;

    // ── create ───────────────────────────────────────────────────────────────
    @PluginMethod
    public void create(PluginCall call) {
        final int    x      = call.getInt("x",      0);
        final int    y      = call.getInt("y",      0);
        final int    width  = call.getInt("width",  0);
        final int    height = call.getInt("height", 0);
        final boolean muted = Boolean.TRUE.equals(call.getBoolean("muted", true));

        call.setKeepAlive(true);

        mainHandler.post(() -> {
            // Destroy any previously active player first.
            releaseInternal();

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

            // Position overlay above WebView in the DecorView
            int[] wvLoc = new int[2];
            getBridge().getWebView().getLocationOnScreen(wvLoc);
            int screenX = wvLoc[0] + x;
            int screenY = wvLoc[1] + y;

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(width, height);
            lp.leftMargin = screenX;
            lp.topMargin  = screenY;

            ViewGroup decorView = (ViewGroup) getActivity().getWindow().getDecorView();
            decorView.addView(container, lp);

            // Build ExoPlayer
            player = new ExoPlayer.Builder(getContext()).build();
            player.setVideoTextureView(textureView);
            player.setVolume(muted ? 0f : 1f);
            // SCALE_TO_FIT_WITH_CROPPING = "cover" mode — fills the container,
            // crops the sides if aspect ratio differs (matches cropMode = 'crop').
            player.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);

            // Observe player state
            player.addListener(new Player.Listener() {
                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
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
        trimStartMs = Math.max(0, startMs);
        trimEndMs   = endMs > 0 ? endMs : Long.MAX_VALUE;
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
        isReleased = true;

        if (timeUpdateTask != null) {
            mainHandler.removeCallbacks(timeUpdateTask);
            timeUpdateTask = null;
        }

        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }

        if (container != null) {
            try {
                ViewGroup parent = (ViewGroup) container.getParent();
                if (parent != null) parent.removeView(container);
            } catch (Exception ignored) {}
            container = null;
            textureView = null;
        }
    }

    private void startTimeUpdateLoop() {
        timeUpdateTask = new Runnable() {
            @Override
            public void run() {
                if (isReleased || player == null) return;

                long pos = player.getCurrentPosition();

                // Trim-range loop: seek back to start when end is reached.
                // 250 ms lookahead matches the WebView timeupdate interval.
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
}
