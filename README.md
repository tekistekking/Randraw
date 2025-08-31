# Autonomous AI Painter

A fully autonomous, client‑side generative painter that:
- **draws a brand‑new picture over exactly 60 seconds** (live brush strokes),
- then opens a **10‑second download window**,
- and repeats forever.

Built with **Vite + React + TypeScript + Tailwind**. Zero servers/APIs required.

## Local Dev
```bash
npm i
npm run dev
# open the URL Vite prints (usually http://localhost:5173)
```

## Build
```bash
npm run build
npm run preview   # optional: serve /dist locally
```

## Deploy to Vercel
Two easy options:

### A) From this folder
1. Install the Vercel CLI and login:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Build and deploy:
   ```bash
   npm run build
   vercel --prod
   # Vercel will detect the static build at /dist via vercel.json
   ```

### B) Via GitHub
1. Push this folder to a new GitHub repo.
2. In the Vercel dashboard, **Import Project** from GitHub.
3. Framework preset: **Vite** (or auto‑detected). Build command: `npm run build`. Output dir: `dist`.
4. Click Deploy.

## Notes
- The app is full‑screen and responsive; on resize it restarts a fresh minute for crisp results.
- Each cycle is seeded and deterministic per cycle; palettes and vector fields vary automatically.
- Your PNG is generated client‑side — no uploads.

Enjoy ✨
