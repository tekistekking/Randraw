# randraw (Autonomous AI Painter, globally synced)

A fully autonomous, client‑side generative painter that:
- **draws a brand‑new picture over exactly 60 seconds** (live brush strokes),
- then opens a **10‑second download window**,
- and repeats forever.

Now with **global sync**:
- All browsers use a fixed UTC epoch + a lightweight **/api/time** edge function.
- Refreshing **does not restart** mid‑minute; the app **fast‑forwards** to the current moment.
- If **/api/time** is unreachable (local dev), it falls back to local time and still works.

## Dev
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy (Vercel)
- Import this project or run:
```bash
npx vercel --prod
```
Vercel picks up the static build (`dist`) and deploys the function at `/api/time`.
