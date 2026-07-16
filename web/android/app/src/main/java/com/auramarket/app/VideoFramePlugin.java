package com.auradime.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * VideoFramePlugin — native video picker + MediaMetadataRetriever filmstrip frames.
 *
 * Methods:
 *   pickVideo(count?, quality?, maxWidth?)
 *     Opens the system video picker. After selection, extracts `count` evenly-spaced
 *     JPEG filmstrip frames using MediaMetadataRetriever (hardware decoder, no WebView
 *     contention). Returns everything in one call so the UI can show the filmstrip
 *     immediately after picking.
 *
 *   getFrames(uri, count?, durationMs?, quality?, maxWidth?)
 *     Re-extract frames from a content:// URI already picked.
 *
 *   getFrame(uri, timeMs?, quality?, maxWidth?)
 *     Single frame at a precise time (ms). Useful for the first-frame thumbnail.
 */
@CapacitorPlugin(name = "VideoFrame")
public class VideoFramePlugin extends Plugin {

    private final ExecutorService executor = Executors.newCachedThreadPool();

    // ── pickVideo ─────────────────────────────────────────────────────────────
    @PluginMethod
    public void pickVideo(PluginCall call) {
        call.setKeepAlive(true);
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("video/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call, intent, "onPickVideoResult");
    }

    @ActivityCallback
    private void onPickVideoResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) { call.reject("No URI returned"); return; }

        // Persist read permission so the app can re-open this URI later (e.g. during upload).
        try {
            getActivity().getContentResolver().takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception ignored) {}

        final int count    = call.hasOption("count")    ? call.getInt("count")    : 8;
        final int quality  = call.hasOption("quality")  ? call.getInt("quality")  : 72;
        final int maxWidth = call.hasOption("maxWidth") ? call.getInt("maxWidth") : 320;

        final Context ctx     = getContext();
        final Uri     finalUri = uri;

        executor.execute(() -> {
            JSObject res = buildVideoResult(ctx, finalUri, count, quality, maxWidth);
            call.resolve(res);
        });
    }

    // ── getFrames ─────────────────────────────────────────────────────────────
    @PluginMethod
    public void getFrames(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("uri is required"); return; }

        final int  count      = call.hasOption("count")      ? call.getInt("count")      : 8;
        final int  quality    = call.hasOption("quality")    ? call.getInt("quality")    : 72;
        final int  maxWidth   = call.hasOption("maxWidth")   ? call.getInt("maxWidth")   : 320;
        final long durationMs = call.hasOption("durationMs") ? call.getLong("durationMs"): 0L;

        final Context ctx = getContext();
        final Uri     uri = Uri.parse(uriStr);
        call.setKeepAlive(true);

        executor.execute(() -> {
            MediaMetadataRetriever r = new MediaMetadataRetriever();
            try {
                r.setDataSource(ctx, uri);
                long dur = durationMs;
                if (dur <= 0) {
                    String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    dur = d != null ? Long.parseLong(d) : 0;
                }
                JSObject res = new JSObject();
                res.put("frames", extractFrames(r, count, dur, quality, maxWidth));
                call.resolve(res);
            } catch (Exception e) {
                call.reject("getFrames failed: " + e.getMessage());
            } finally {
                try { r.release(); } catch (Exception ignored) {}
            }
        });
    }

    // ── getFrame ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void getFrame(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("uri is required"); return; }

        final long timeMs   = call.hasOption("timeMs")   ? call.getLong("timeMs")   : 0L;
        final int  quality  = call.hasOption("quality")  ? call.getInt("quality")   : 80;
        final int  maxWidth = call.hasOption("maxWidth") ? call.getInt("maxWidth")  : 480;

        final Context ctx = getContext();
        final Uri     uri = Uri.parse(uriStr);
        call.setKeepAlive(true);

        executor.execute(() -> {
            MediaMetadataRetriever r = new MediaMetadataRetriever();
            try {
                r.setDataSource(ctx, uri);
                Bitmap bmp = r.getFrameAtTime(timeMs * 1000L,
                    MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                if (bmp == null) { call.reject("No frame at " + timeMs + "ms"); return; }
                String dataUrl = bitmapToDataUrl(bmp, quality, maxWidth);
                bmp.recycle();
                JSObject res = new JSObject();
                res.put("frame", dataUrl);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("getFrame failed: " + e.getMessage());
            } finally {
                try { r.release(); } catch (Exception ignored) {}
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Build the full result object for a picked URI: metadata + frames. */
    private JSObject buildVideoResult(Context ctx, Uri uri, int count, int quality, int maxWidth) {
        JSObject res = new JSObject();
        res.put("uri", uri.toString());

        // File name + size from ContentResolver
        try (Cursor c = ctx.getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int si = c.getColumnIndex(OpenableColumns.SIZE);
                if (ni >= 0) res.put("displayName", c.getString(ni));
                if (si >= 0) res.put("size", c.getLong(si));
            }
        } catch (Exception ignored) {}

        // Video metadata + frames via MediaMetadataRetriever
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
            r.setDataSource(ctx, uri);

            String mime = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE);
            String durS = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            String wStr = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
            String hStr = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);

            if (mime != null) res.put("mimeType", mime);

            long durMs = durS != null ? Long.parseLong(durS) : 0;
            res.put("duration",   durMs / 1000.0);   // seconds (double)
            res.put("durationMs", durMs);              // ms (long)

            if (wStr != null) res.put("width",  Integer.parseInt(wStr));
            if (hStr != null) res.put("height", Integer.parseInt(hStr));

            res.put("frames", extractFrames(r, count, durMs, quality, maxWidth));
        } catch (Exception e) {
            res.put("frames", new JSArray());
            res.put("frameError", e.getMessage());
        } finally {
            try { r.release(); } catch (Exception ignored) {}
        }
        return res;
    }

    /**
     * Extract `count` evenly-spaced frames across the video's duration.
     * Avoids the very first and last 2% of the video where black frames are common.
     */
    private JSArray extractFrames(MediaMetadataRetriever r, int count, long durMs,
                                   int quality, int maxWidth) {
        JSArray out = new JSArray();
        if (durMs <= 0 || count <= 0) return out;

        long startMs = Math.max(0L, (long)(durMs * 0.02));
        long endMs   = Math.min(durMs, (long)(durMs * 0.98));
        long range   = endMs - startMs;
        if (range <= 0) { startMs = 0; range = durMs; }

        for (int i = 0; i < count; i++) {
            long timeMs = count == 1
                ? startMs + range / 2
                : startMs + (range * i / (count - 1));

            Bitmap bmp;
            // API 28+ OPTION_CLOSEST is more accurate; older devices use sync key-frames.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                bmp = r.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST);
            } else {
                bmp = r.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            }
            if (bmp != null) {
                try {
                    out.put(bitmapToDataUrl(bmp, quality, maxWidth));
                } catch (Exception ignored) {
                } finally {
                    bmp.recycle();
                }
            }
        }
        return out;
    }

    /** Scale bitmap to maxWidth (preserving aspect) and encode as JPEG data URL. */
    private String bitmapToDataUrl(Bitmap src, int quality, int maxWidth) {
        Bitmap bmp = src;
        if (maxWidth > 0 && bmp.getWidth() > maxWidth) {
            int w = maxWidth;
            int h = Math.round(bmp.getHeight() * (float) w / bmp.getWidth());
            bmp = Bitmap.createScaledBitmap(src, w, h, true);
        }
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, buf);
        if (bmp != src) bmp.recycle();
        String b64 = Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP);
        return "data:image/jpeg;base64," + b64;
    }
}
