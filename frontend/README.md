# Cutroom — video frontend (React + Vite)

UI for the Node.js HLS video backend: library, drag-and-drop upload with progress, and a custom HLS player with quality switching and storyboard previews on the seek bar.

## Structure
```
video-frontend/
├── index.html
├── vite.config.js            proxies /api and /media to the backend
├── .env.example              VITE_API_URL (production only)
└── src/
    ├── main.jsx, App.jsx     router + top bar
    ├── api.js                fetch helpers + XHR upload with progress
    ├── styles.css            design tokens + all styles
    ├── pages/
    │   ├── Home.jsx          library grid (auto-refreshes while processing)
    │   ├── Upload.jsx        drop zone, title, description, progress
    │   └── Watch.jsx         player, or queued / processing / failed state
    ├── components/
    │   ├── Player.jsx        hls.js player, quality menu, scrub previews
    │   ├── VideoCard.jsx
    │   └── StatusBadge.jsx
    └── lib/
        ├── vtt.js            parses storyboard.vtt sprite cues
        └── format.js         time / size helpers
```

## Run
Start the backend first (API on port 3000), then:
```bash
npm install
npm run dev        # http://localhost:5173
```
Using a different backend port: `VITE_BACKEND=http://localhost:4000 npm run dev`

## Production
```bash
VITE_API_URL=https://api.example.com npm run build   # outputs dist/
```
The backend already sends CORS headers (`cors()`), so `dist/` can be hosted anywhere static.

## Player shortcuts
Space or K play/pause, ←/→ seek 5s, J/L seek 10s, M mute, F fullscreen.
