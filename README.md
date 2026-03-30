# 富士山 Fuji Visibility PWA

A progressive web app that shows daily Mt. Fuji visibility forecasts — north & south, morning & afternoon — with offline support and Android widget data.

## Features

- Real-time forecast from [fuji-visibility-api](https://fuji-visibility-api.onrender.com/visibility)
- Animated Fuji SVG that reflects current visibility conditions
- Offline-capable via service worker (network-first for API, cache-first for app shell)
- Installable PWA — standalone display, no browser chrome
- Android widget support via `manifest.json` widgets array + `/widget-data.json`
- Japanese-aesthetic design (washi paper light / ink dark)

## Structure

```
index.html          App shell
styles.css          Design tokens + layout
app.js              Fetch, render, SW registration
sw.js               Service worker (cache-first / network-first)
manifest.json       PWA manifest with widget definition
widget-data.json    Placeholder populated by SW from live API data
vercel.json         Static host config (SPA rewrites)
icons/
  icon.svg          App icon (any size, SVG)
  icon-apple.svg    Apple touch icon
  icon-maskable.svg Maskable icon for Android adaptive icons
  widget-bg.svg     Widget background
```

## Deploy

```bash
# Vercel (recommended)
npx vercel --prod

# Or any static host — just serve the root directory.
# The vercel.json rewrites handle SPA navigation.
```

## API shape expected

```json
{
  "updated_at": "2024-01-15T06:00:00Z",
  "forecast": [
    {
      "date": "2024-01-15",
      "north": { "morning": 8, "afternoon": 6 },
      "south": { "morning": 7, "afternoon": 5 }
    }
  ]
}
```

Scores are 1–10. The app maps them to four tiers: high (8–10), med (5–7), low (3–4), poor (1–2).
