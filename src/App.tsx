
import React, { useEffect, useRef, useState } from "react";
import type { PlanResult } from "./motifs";
import { choosePalette, makeRng } from "./motifs";
import { SUBJECTS, LANDSCAPES, ABSTRACTS, ALL_GENERATORS, getGenerator } from "./registry";

const DRAW_MS = 40_000;
const COOLDOWN_MS = 0;
const EPOCH_ISO = "2024-01-01T00:00:00.000Z";
const EPOCH_MS = Date.parse(EPOCH_ISO);

const clamp = (v:number,a:number,b:number)=> Math.max(a, Math.min(b, v));
type Recipe = { i:number; seed:number; generator:string; palette:number; level?:number };

// ---- Performance helpers ----
async function safeJson(r: Response) { try { return await r.json(); } catch { return null; } }
async function getJson(url: string) { try { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) return null; return await safeJson(r); } catch { return null; } }
function estimateThroughput(): number {
  try {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 150;
    const ctx = c.getContext('2d')!;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.globalAlpha = 0.5;
    const N = 800, t0 = performance.now();
    for (let i = 0; i < N; i++) { ctx.beginPath(); const x = (i % 40) * 6 + 2, y = (i / 40 | 0) * 3 + 1; ctx.moveTo(x,y); ctx.lineTo(x+3,y+1); ctx.stroke(); }
    return N / Math.max(1, performance.now() - t0);
  } catch { return 10; }
}
function thinPlan(plan: PlanResult, maxSegments: number): PlanResult {
  const segs = plan.segments;
  if (segs.length <= maxSegments) return plan;
  const keep: typeof segs = [];
  const ratio = segs.length / maxSegments;
  for (let i = 0; i < segs.length; i++) {
    if (i < maxSegments * 0.6) keep.push(segs[i]);
    else if (Math.random() < 1 / ratio) keep.push(segs[i]);
    if (keep.length >= maxSegments) break;
  }
  return { ...plan, segments: keep };
}

// ---- Densifier (deterministic) ----
function densifyPlan(plan: PlanResult, factor: number, rngSeed?: number): PlanResult {
  if (!plan || !plan.segments || factor <= 1.01) return plan;
  const segs = plan.segments;
  let s = ((rngSeed ?? 1) >>> 0) || 1;
  const rng = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

  const extra: typeof segs = [];
  const copies = Math.min(2, Math.max(1, Math.floor(factor)));
  const frac = Math.min(1, Math.max(0, factor - Math.floor(factor)));
  const jitter = 0.8 * (factor - 1);

  for (let i = 0; i < segs.length; i++) {
    const base = segs[i];
    for (let k = 0; k < copies - 1; k++) {
      const jx = (rng() - 0.5) * jitter, jy = (rng() - 0.5) * jitter;
      extra.push({ ...base, x1: base.x1 + jx, y1: base.y1 + jy, x2: base.x2 + jx, y2: base.y2 + jy, w: Math.max(0.6, base.w * 0.92), alpha: base.alpha * 0.55 });
    }
    if (rng() < frac) {
      const jx = (rng() - 0.5) * jitter, jy = (rng() - 0.5) * jitter;
      extra.push({ ...base, x1: base.x1 + jx, y1: base.y1 + jy, x2: base.x2 + jx, y2: base.y2 + jy, w: Math.max(0.6, base.w * 0.9), alpha: base.alpha * 0.5 });
    }
  }
  return { ...plan, segments: segs.concat(extra) };
}

// ---- Painterly engine (composite) ----
function fillEllipse(ctx: CanvasRenderingContext2D, x:number, y:number, rx:number, ry:number, rotation:number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.scale(Math.max(0.0001, rx), Math.max(0.0001, ry));
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

type BrushKit = {
  detail: number;
  useDry: boolean;
  useWash: boolean;
  useSplatter: boolean;
  useHatch: boolean;
  hatchAngleDeg: number;
};
function seededRng(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }
function brushKitFor(level:number, motif:string): BrushKit {
  const L = Math.max(0, level|0);
  const detail = Math.min(3, 1 + L * 0.18);
  const useDry = L >= 1;
  const useWash = L >= 2;
  const useHatch = L >= 2 && (motif.includes("mountain") || motif.includes("city") || motif.includes("meadow") || motif.includes("tree") || motif.includes("person"));
  const useSplatter = L >= 3 && (motif.includes("lighthouse") || motif.includes("waves") || motif.includes("abstract") || motif.includes("volcano"));
  const hatchAngleDeg = 30 + (L % 3) * 15;
  return { detail, useDry, useWash, useSplatter, useHatch, hatchAngleDeg };
}
function paintDabsRound(ctx:CanvasRenderingContext2D, s:any, rng:()=>number, detail:number) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const spacing = Math.max(3, 8 - Math.min(4.5, (detail - 1) * 3.0));
  let steps = Math.min(24, Math.max(2, Math.floor(len / spacing)));
  const ux = dx / len, uy = dy / len;
  const baseAlpha = clamp(s.alpha, 0.06, 0.9);
  const col = s.color as string;
  if ((ctx as any).fillStyle !== col) (ctx as any).fillStyle = col;
  if ((ctx as any).globalAlpha !== baseAlpha) (ctx as any).globalAlpha = baseAlpha;
  for (let i=0;i<steps;i++) {
    const t = steps>1 ? i/(steps-1) : 0;
    const press = 0.6 + 0.8 * Math.sin(Math.PI * t);
    const jitterMag = (detail - 1) * 0.8 + 0.4;
    const jx = (rng() - 0.5) * jitterMag;
    const jy = (rng() - 0.5) * jitterMag;
    const px = s.x1 + ux * len * t + jx;
    const py = s.y1 + uy * len * t + jy;
    const r = Math.max(0.6, (s.w * 0.5) * press);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
  }
}
function paintDabsDry(ctx:CanvasRenderingContext2D, s:any, rng:()=>number, detail:number) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const spacing = Math.max(4, 11 - Math.min(5, (detail - 1) * 3.0));
  let steps = Math.min(18, Math.max(2, Math.floor(len / spacing)));
  const ux = dx / len, uy = dy / len;
  const baseAlpha = clamp(s.alpha * 0.85, 0.05, 0.8);
  const col = s.color as string;
  if ((ctx as any).fillStyle !== col) (ctx as any).fillStyle = col;
  if ((ctx as any).globalAlpha !== baseAlpha) (ctx as any).globalAlpha = baseAlpha;
  for (let i=0;i<steps;i++) {
    const t = steps>1 ? i/(steps-1) : 0;
    const press = 0.5 + 0.7 * Math.sin(Math.PI * t);
    const jitterMag = (detail - 1) * 1.2 + 0.6;
    const px = s.x1 + ux * len * t + (rng()-0.5)*jitterMag;
    const py = s.y1 + uy * len * t + (rng()-0.5)*jitterMag;
    const rx = Math.max(0.6, (s.w * 0.7) * press);
    const ry = Math.max(0.5, (s.w * 0.35) * press);
    const ang = (rng() - 0.5) * Math.PI;
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}
function paintWash(ctx:CanvasRenderingContext2D, s:any, rng:()=>number, detail:number) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const step = Math.max(20, 60 - (detail-1)*10);
  const n = Math.min(6, Math.max(1, Math.floor(len / step)));
  const ux = dx/len, uy=dy/len;
  const alpha = clamp(s.alpha * 0.25, 0.03, 0.25);
  if ((ctx as any).globalAlpha !== alpha) (ctx as any).globalAlpha = alpha;
  if ((ctx as any).fillStyle !== s.color) (ctx as any).fillStyle = s.color;
  for (let i=0;i<n;i++){
    const t = (i+0.3)/(n+0.6);
    const px = s.x1 + ux*len*t + (rng()-0.5)*3;
    const py = s.y1 + uy*len*t + (rng()-0.5)*3;
    const r = Math.max(4, s.w*1.2 + rng()*6);
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
  }
}
function paintSplatter(ctx:CanvasRenderingContext2D, s:any, rng:()=>number, detail:number) {
  const count = Math.min(12, 4 + Math.floor(detail*2));
  const alpha = clamp(s.alpha * 0.35, 0.04, 0.35);
  if ((ctx as any).globalAlpha !== alpha) (ctx as any).globalAlpha = alpha;
  if ((ctx as any).fillStyle !== s.color) (ctx as any).fillStyle = s.color;
  const ex = s.x2, ey = s.y2;
  for (let i=0;i<count;i++){
    const ang = rng()*Math.PI*2;
    const r = 2 + rng()*6;
    const d = 2 + rng()*14;
    const x = ex + Math.cos(ang)*d;
    const y = ey + Math.sin(ang)*d;
    ctx.beginPath(); ctx.arc(x,y,r*0.35,0,Math.PI*2); ctx.fill();
  }
}
function paintHatch(ctx:CanvasRenderingContext2D, s:any, rng:()=>number, detail:number, angleDeg:number) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const spacing = Math.max(10, 18 - detail*2);
  const n = Math.min(10, Math.max(2, Math.floor(len / spacing)));
  const rad = angleDeg * Math.PI/180;
  const hx = Math.cos(rad), hy = Math.sin(rad);
  const alpha = clamp(s.alpha * 0.45, 0.05, 0.6);
  if ((ctx as any).globalAlpha !== alpha) (ctx as any).globalAlpha = alpha;
  if ((ctx as any).strokeStyle !== s.color) (ctx as any).strokeStyle = s.color;
  if ((ctx as any).lineWidth !== Math.max(0.8, s.w*0.5)) (ctx as any).lineWidth = Math.max(0.8, s.w*0.5);
  for (let i=0;i<n;i++) {
    const t = (i+0.3)/(n+0.6);
    const cx = s.x1 + dx*t + (rng()-0.5)*2;
    const cy = s.y1 + dy*t + (rng()-0.5)*2;
    const L = 6 + detail*2;
    ctx.beginPath();
    ctx.moveTo(cx - hx*L, cy - hy*L);
    ctx.lineTo(cx + hx*L, cy + hy*L);
    ctx.stroke();
  }
}
function paintSegmentComposite(ctx:CanvasRenderingContext2D, s:any, kit:BrushKit, rngSeed:number) {
  const rng = seededRng(rngSeed);
  paintDabsRound(ctx, s, rng, kit.detail);
  if (kit.useDry)      paintDabsDry(ctx, s, rng, kit.detail);
  if (kit.useWash)     paintWash(ctx, s, rng, kit.detail);
  if (kit.useSplatter) paintSplatter(ctx, s, rng, kit.detail);
  if (kit.useHatch)    paintHatch(ctx, s, rng, kit.detail, kit.hatchAngleDeg);
}
function estimateOpsPerSeg(kit:BrushKit) {
  let ops = 6;
  ops += 10 * kit.detail;
  if (kit.useDry) ops += 8 * kit.detail;
  if (kit.useWash) ops += 6;
  if (kit.useSplatter) ops += 10;
  if (kit.useHatch) ops += 8;
  return ops;
}

// ---- Variety & sync helpers ----
function cycleInfo(nowMs: number) {
  const sinceEpoch = nowMs - EPOCH_MS;
  const cycleIndex = Math.floor(sinceEpoch / (DRAW_MS + COOLDOWN_MS));
  const into = sinceEpoch - cycleIndex * (DRAW_MS + COOLDOWN_MS);
  const inDrawing = into < DRAW_MS;
  const p = inDrawing ? clamp(into / DRAW_MS, 0, 1) : 1;
  return { cycleIndex, inDrawing, progress: p };
}
const seedForCycle = (i: number) => (Math.imul((i ^ 0x9e37) >>> 0, 2654435761) ^ 0x85ebca6b) >>> 0;
function getLast(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function setLast(key: string, val: string) { try { localStorage.setItem(key, val); } catch {} }
function chooseWithVariety(cycleIndex: number, lastGen: string | null, recipeGen?: string): string {
  if (recipeGen && recipeGen !== lastGen) return recipeGen;
  const catIndex = cycleIndex % 3;
  const cat = catIndex === 0 ? SUBJECTS : (catIndex === 1 ? LANDSCAPES : ABSTRACTS);
  const pool = (cat as readonly string[]).filter(g => g !== lastGen);
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  const allPool = (ALL_GENERATORS as readonly string[]).filter(g => g !== lastGen);
  return allPool[Math.floor(Math.random() * allPool.length)];
}
async function getServerOffsetMs(): Promise<number> {
  try {
    const t0 = Date.now();
    const j: any = await getJson("/api/time");
    if (!j || typeof j.serverNow !== "number") return 0;
    const t1 = Date.now();
    const rtt2 = Math.floor((t1 - t0) / 2);
    return (j.serverNow + rtt2) - t1;
  } catch { return 0; }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const throughputRef = useRef<number>(0);
  const serverOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const currentCycleIndexRef = useRef<number | null>(null);
  const planRef = useRef<PlanResult | null>(null);
  const planMetaRef = useRef<{complexity:number, brushKit:any}>({complexity:1, brushKit:null});
  const segIndexRef = useRef(0);

  const [phase, setPhase] = useState<"drawing" | "cooldown">("drawing");
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentMotif, setCurrentMotif] = useState<string>("");

  const resizeCanvas = () => {
    const canvas = canvasRef.current!;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const paintBg = (ctx: CanvasRenderingContext2D, plan: PlanResult) => {
    const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    (ctx as any).globalAlpha = 1.0;
    (ctx as any).fillStyle = plan.bg;
    (ctx as any).fillRect(0, 0, w, h);
  };

  const planAndCatchUp = async () => {
    try {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);

    // fetch recipe
    let recipe: Recipe | null = null;
    try {
      const j: any = await getJson(`/api/recipe?i=${info.cycleIndex}`);
      if (j && j.ok && j.recipe) recipe = j.recipe as Recipe;
    } catch {}

    const lastGen = getLast("randraw_last_gen");
    let motifName = chooseWithVariety(info.cycleIndex, lastGen, recipe?.generator);
    setCurrentMotif(motifName);
    setLast("randraw_last_gen", motifName);

    const seed = (recipe?.seed ?? seedForCycle(info.cycleIndex)) >>> 0;
    const rng = makeRng(seed);
    const palette = choosePalette(rng);

    const gen = getGenerator(motifName);
    planRef.current = gen(w, h, seed, palette);

    // sophistication & densify
    const level = (recipe && recipe.level != null) ? recipe.level! : Math.floor(info.cycleIndex / 12);
    const complexityFactor = Math.min(2.0, 1 + level * 0.12);
    planRef.current = densifyPlan(planRef.current, complexityFactor, seed ^ 0xabc0ffee);

    // painterly kit
    const kit = brushKitFor(level, motifName);
    planMetaRef.current.complexity = complexityFactor;
    planMetaRef.current.brushKit = kit;

    // performance budget with kit
    if (!throughputRef.current) throughputRef.current = estimateThroughput();
    {
      const ops = ((): number => {
        let o = 6 + 10*kit.detail;
        if (kit.useDry) o += 8*kit.detail;
        if (kit.useWash) o += 6;
        if (kit.useSplatter) o += 10;
        if (kit.useHatch) o += 8;
        return o;
      })();
      const thr = throughputRef.current;
      const segBudget = Math.min(7000, Math.max(300, Math.floor((thr * DRAW_MS * 0.85) / Math.max(8, ops))));
      planRef.current = thinPlan(planRef.current, segBudget);
    }

    // background
    paintBg(ctx, planRef.current!);

    // fast-forward
    const total = planRef.current!.segments.length;
    const target = Math.floor(total * info.progress);
    let i = 0;
    while (i < target) {
      const s = planRef.current!.segments[i++];
      paintSegmentComposite(ctx, s, kit, (seed ^ i * 1013904223) >>> 0);
    }
    segIndexRef.current = target;
    setPhase(info.inDrawing ? "drawing" : "cooldown");
    setProgress(info.progress);
    setErr(null);
    } catch (e:any) {
      console.error("planAndCatchUp failed", e);
      setErr("Renderer error — using local fallback");
      // minimal fallback: clear & keep going
      const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0,0,canvas.clientWidth, canvas.clientHeight);
    }
  };

  const drawLoop = async () => {
    try {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);

    if (currentCycleIndexRef.current === null || currentCycleIndexRef.current !== info.cycleIndex) {
      // finish remaining strokes
      if (currentCycleIndexRef.current !== null && planRef.current) {
        const prevPlan = planRef.current; let j = segIndexRef.current;
        const totalPrev = prevPlan.segments.length;
        const kit = planMetaRef.current.brushKit || brushKitFor(0, "abstract");
        const seed = seedForCycle(currentCycleIndexRef.current);
        while (j < totalPrev) {
          const s = prevPlan.segments[j++];
          paintSegmentComposite(ctx, s, kit, (seed ^ j * 1013904223) >>> 0);
        }
        segIndexRef.current = totalPrev;
      }
      currentCycleIndexRef.current = info.cycleIndex;
      await planAndCatchUp();
      rafRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    if (info.inDrawing && planRef.current) {
      setPhase("drawing");
      const total = planRef.current.segments.length;
      const target = Math.floor(total * info.progress);
      let i = segIndexRef.current;
      const kit = planMetaRef.current.brushKit || brushKitFor(0, "abstract");
      const seed = seedForCycle(info.cycleIndex);
      while (i < target) {
        const s = planRef.current.segments[i++];
        paintSegmentComposite(ctx, s, kit, (seed ^ i * 1013904223) >>> 0);
      }
      segIndexRef.current = i;
      setProgress(info.progress);
    }

    rafRef.current = requestAnimationFrame(drawLoop);
    } catch (e:any) { console.error("drawLoop error", e); setErr("Draw loop error — recovering..."); rafRef.current = requestAnimationFrame(drawLoop); }
  };

  useEffect(() => {
    (async () => {
      serverOffsetRef.current = await getServerOffsetMs();
      resizeCanvas();
      await planAndCatchUp();
      rafRef.current = requestAnimationFrame(drawLoop);
    })();
    const onResize = () => { resizeCanvas(); planAndCatchUp(); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = Math.floor(progress * 100);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none" style={{ background:"#0a0a0a", color:"#eaeaea" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* HUD left */}
      <div className="absolute top-4 left-4 z-20" style={{ padding:"12px", borderRadius:"16px", background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", fontSize:"12px", lineHeight:1.2 }}>
        <div className="flex items-center" style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <img src="/randraw.png" alt="randraw logo" style={{ width:24, height:24, borderRadius:999, outline:"1px solid rgba(255,255,255,0.2)" }} />
          <div style={{ fontWeight:600, letterSpacing:"0.02em", color:"#ddd" }}>randraw</div>
        </div>
        <div style={{ marginTop:6 }}>
          {"Live drawing"}
          {currentMotif && <span style={{ marginLeft:8, opacity:0.7 }}>· motif: {currentMotif}</span>}
        </div>
        <div style={{ marginTop:8, width:256, height:8, background:"rgba(255,255,255,0.12)", borderRadius:999 }}>
          <div style={{ width:`${progressPct}%`, height:"100%", background:"#fff", borderRadius:999 }} />
        </div>
        <div style={{ marginTop:4, fontSize:11, opacity:0.8 }}>{progressPct}%</div>
      </div>

      {/* Social top-right (text) */}
      <div className="absolute top-4 right-4 z-20">
        <a href="https://x.com/randrawsol" target="_blank" rel="noopener noreferrer"
           aria-label="Follow randraw on Twitter" title="Follow randraw on Twitter"
           style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 12px", height:40, borderRadius:999, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", outline:"1px solid rgba(255,255,255,0.12)", color:"#fff", textDecoration:"none" }}>twitter</a>
      </div>

      {/* Error overlay */}
      {err && (
        <div className="absolute top-1/2 left-1/2 z-30" style={{transform:"translate(-50%,-50%)", padding:"12px 16px", borderRadius:"12px", background:"rgba(255,60,60,0.12)", outline:"1px solid rgba(255,80,80,0.4)", color:"#fff", fontSize:13}}>
          {err}
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-4 right-4 z-20" style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>
        randraw · 40s draw · synced globally
      </div>
    </div>
  );
}
