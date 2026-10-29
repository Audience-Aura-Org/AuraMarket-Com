# Google Maps setup

Auradime uses Google Maps (address pin, live rider tracking, admin live map) when a
key is configured, and the free MapLibre/OpenStreetMap maps otherwise.

## 1. Google Cloud

1. Go to <https://console.cloud.google.com/>, create a project (e.g. "Auradime").
2. **Billing**: link a billing account (required, even within the free monthly allowance).
3. **APIs & Services → Library**: enable **Maps JavaScript API**.
4. **Google Maps Platform → Map management → Create map ID**: type *JavaScript*, *Vector*.
   Copy the Map ID. (Without one, `DEMO_MAP_ID` is used, which is for testing only.)

## 2. API key

**APIs & Services → Credentials → Create credentials → API key**, then *Edit*:

- Application restrictions: **Websites**, add:
  - `https://auradime.com/*`
  - `https://*.auradime.com/*`
  - `https://localhost/*` (the Android app's own pages)
  - `http://localhost:3102/*` (local development)
- API restrictions: **Maps JavaScript API** only.

## 3. Configure the website and app

In `web/.env.local` (and the hosting provider's environment for the website):

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your-map-id
```

These are read at build time: rebuild/redeploy the website, and build a new APK, after
setting them. Remove the key to go back to the free maps.

## Cost

Website and app map loads use the Maps JavaScript API: the first 10,000 per month are
free, then about USD 7 per 1,000. Set a budget alert in Google Cloud Billing.
