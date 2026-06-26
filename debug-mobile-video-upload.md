# Debug Session: mobile-video-upload
- **Status**: [OPEN]
- **Issue**: Device still shows removed debug logs and `Load failed` during video upload.
- **Observation**: Current repo no longer contains `[StatusCreator] handlePost state check` or `[StatusVideo] FormData being sent`, but the device still logs them.
- **Backend Evidence**: PM2 log shows `❌ [API] No file provided in request` and `❌ [API] Received fields: no req.files object`, proving the request reaches `/upload/single` without a valid multipart file body.

## Current Hypotheses
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The mobile app is running an older web bundle / native build and not the latest `main`. | Medium | Low | Mixed evidence |
| B | The device is loading a stale cached bundle from WebView/service worker instead of the latest deployed code. | Medium | Low | Mixed evidence |
| C | Mobile web is sending a malformed non-multipart request, so multer sees no `req.files` at all. | High | Low | Supported |
| D | `instanceof FormData` is unreliable in the mobile browser path, causing the API layer to preserve or inject the wrong `Content-Type`. | High | Low | Supported |
