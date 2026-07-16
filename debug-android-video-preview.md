# Debug Session: android-video-preview

- Status: SHIPPED
- APK: `web/public/downloads/Auradime.apk` (built 2026-07-16)
- Scope: `web/components/status/StatusCreator.js`

## Symptom

In Android APK, picking a video in status creation showed:
- Gray/black preview area (video not visible)
- Filmstrip showing black tiles or nothing
- Duration did appear in the trim UI (confirmed metadata loaded)

## Root Causes Found

### 1. Filmstrip offscreen video competed for the hardware decoder
The filmstrip `useEffect` created a second `<video>` element (160×90, opacity 0.01)
and loaded the same blob URL. Android WebView has 1–2 hardware decoder slots.
Both the preview and the filmstrip video tried to claim the decoder simultaneously,
causing both to go black. A 1500ms delay was already there but didn't help because
the offscreen video still loaded while the preview was actively playing.

**Fix:** Early return from the filmstrip `useEffect` on `isNativePlatform()`.
The existing animated-gradient placeholder renders when `timelineFrames` is empty.

### 2. `readVideoMetadata()` treated `onerror` as success
The metadata reader registered `video.onerror = done` where `done` resolved the
promise. If Android failed to decode the file, the timeout or error path silently
"succeeded" with fallback values. This let the UI proceed into a broken preview state.

**Fix:** `onerror` now rejects the promise. Timeout also rejects unless `readyState >= 1`
or `videoWidth > 0` or `duration > 0` is already satisfied.

### 3. Temporary metadata video not fully torn down before preview started
`readVideoMetadata()` called `removeChild` but did not clear the `src` attribute
or call `load()` first. On Android WebView this can leave the media pipeline
in a locked state that the next video element inherits.

**Fix:** New `teardownTemporaryVideo()` helper: `pause()` → `removeAttribute('src')`
→ `load()` → `removeChild()`. Used in both `readVideoMetadata` and `generateVideoThumbnail`.

### 4. Dual source management on native preview `<video>`
The visible preview `<video>` received a JSX `src` prop AND the native effect
also called `video.src = previewUrl; video.load()`. On some Android WebView builds
this causes a double-load race where the second load call interrupts the first.

**Fix:** On native, the JSX `src` prop is `undefined` (`nativePreviewSrc`).
The native effect is the sole owner of source assignment.

### 5. 150ms decoder-release gap after metadata extraction
Even with proper teardown, Android WebView may not release the decoder slot
instantaneously. A 150ms delay after `readVideoMetadata` completes gives the
hardware pipeline time to free up before the preview video starts.

## What to Test

Install `Auradime.apk` and open Status Creator. Pick a video (any length).

**Test 1 — Preview plays**
- Preview area should show the video playing (or at minimum a visible first frame)
- It should NOT be black or gray

**Test 2 — Trim timeline shows**
- The filmstrip strip at the top should show 8 animated gradient bars (not blank/missing)
- The green selection window and white playhead should be visible and draggable

**Test 3 — Trim interaction**
- Drag the left/right handles to change trim start/end
- The duration counter (`X.Xs / 60s`) should update as you drag

**Test 4 — Upload still works**
- Post a trimmed video. The server-side trim/transcode path is unchanged.
- Confirm the uploaded status appears correctly in the feed.

**Test 5 — Pick a second video after first**
- Pick a video, then cancel, then pick a different video
- Preview should refresh correctly without going black on the second pick

## Pass / Fail Criteria

| Scenario | Pass |
|---|---|
| Preview shows video or first frame | Yes |
| Filmstrip shows gradient bars | Yes |
| Trim handles work | Yes |
| Upload succeeds | Yes |
| Second pick works | Yes |

## If Preview Is Still Black

Likely the Android WebView on the test device needs more decoder settle time.
Next step: increase the 150ms gap (`setTimeout(resolve, 150)` in `handleFileChange`)
to 400ms and rebuild.

## Commits in This Build

- `443582d9` — disable Android filmstrip canvas extraction (eliminates decoder contention)
- `(working tree)` — teardown helper, onerror rejection, dual-src fix, 150ms gap, DOM-removal safeguard on main preview element
