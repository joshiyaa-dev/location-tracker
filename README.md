# 📍 PathPulse — Real-Time Location Tracker

Live GPS tracking that runs entirely in your browser: position marker,
accuracy radius, trail, distance/elapsed stats and **GPX export** for use in
any mapping app. No frameworks, no map API keys, no accounts, no uploads.

## Features

- Real-time tracking via the browser Geolocation API (`watchPosition`, high accuracy)
- Custom canvas "map": auto-scaling grid (10 m → 2.5 km cells), scroll-zoom, drag-pan
- Accuracy radius visualization + GPS jitter filtering
- Live stats: lat/lng, altitude, speed, total distance, track points, elapsed time
- One-tap Google Maps pin share (Web Share API → clipboard fallback)
- **GPX 1.1 export** — import your track into OsmAnd, Strava, Garmin, Google Earth…
- Installable PWA (manifest + icon)
- Dark UI, mobile responsive

## Run

No build step. Open `index.html` in any browser, or serve statically:

```bash
npx serve .          # or: python -m http.server
```

Geolocation requires HTTPS or localhost.

## Deploy

Pure static files — Vercel / Netlify / GitHub Pages all work with zero config.

## Privacy

Position data exists only in page memory (and a small localStorage preview of
the last session). Nothing is transmitted anywhere.
