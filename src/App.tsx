import React, { useEffect, useRef, useState } from "react";
import { MOTIFS, makeRng, choosePalette, PlanResult } from "./motifs";
import { SUBJECTS, LANDSCAPES, ABSTRACTS, ALL_GENERATORS, getGenerator } from "./registry";

// ---- Cycle timing (global) ----
const DRAW_MS = 40_000;          // 60s live drawing
const COOLDOWN_MS = 0;       // 5s download window
const CYCLE_MS = DRAW_MS + COOLDOWN_MS;

// Fixed UTC epoch for global sync (same time position everywhere)
const EPOCH_ISO = "2024-01-01T00:00:00.000Z";
const EPOCH_MS = Date.parse(EPOCH_ISO);

// Utils
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Recipe = { i:number; seed:number; generator:string; palette:number };

// ---- Server time sync ----
async function getServerOffsetMs(): Promise<number> {
  try {
    const t0 = Date.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const { serverNow } = await res.json();
    const t1 = Date.now();
    const rtt2 = Math.floor((t1 - t0) / 2);
    return (serverNow + rtt2) - t1;
  } catch {
    return 0;
  }
}
function cycleInfo(nowMs: number) {
  const sinceEpoch = nowMs - EPOCH_MS;
  const cycleIndex = Math.floor(sinceEpoch / CYCLE_MS);
  const into = sinceEpoch - cycleIndex * CYCLE_MS;
  const inDrawing = into < DRAW_MS;
  const p = inDrawing ? clamp(into / DRAW_MS, 0, 1) : 1;
  const cooldownLeft = inDrawing ? 0 : Math.max(0, CYCLE_MS - into);
  return { cycleIndex, inDrawing, progress: p, cooldownLeft };
}

// seed usable across runs
const seedForCycle = (i: number) =>
  (Math.imul((i ^ 0x9e37) >>> 0, 2654435761) ^ 0x85ebca6b) >>> 0;

// Increase stroke density for more sophisticated look as cycles advance
function densifyPlan(plan: PlanResult, factor: number): PlanResult {
  if (!plan || !plan.segments || factor <= 1.01) return plan;
  const segs = plan.segments;
  const extra: typeof segs = [];
  const copies = Math.min(2, Math.max(1, Math.floor(factor))); // at most double
  const frac = Math.min(1, Math.max(0, factor - Math.floor(factor))); // fractional part
  const jitter = 0.8 * (factor - 1);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    // integer copies
    for (let k = 0; k < copies - 1; k++) {
      const jx = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;
      extra.push({ ...s, x1: s.x1 + jx, y1: s.y1 + jy, x2: s.x2 + jx, y2: s.y2 + jy, w: Math.max(0.6, s.w * 0.92), alpha: s.alpha * 0.55 });
    }
    // fractional probabilistic extra
    if (Math.random() < frac) {
      const jx = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;
      extra.push({ ...s, x1: s.x1 + jx, y1: s.y1 + jy, x2: s.x2 + jx, y2: s.y2 + jy, w: Math.max(0.6, s.w * 0.9), alpha: s.alpha * 0.5 });
    }
  }
  return { ...plan, segments: segs.concat(extra) };
}

function chooseWithVariety(cycleIndex: number, lastGen: string | null, recipeGen?: string): string {
  if (recipeGen && recipeGen !== lastGen) return recipeGen;
  const catIndex = cycleIndex % 3;
  const cat = catIndex === 0 ? SUBJECTS : (catIndex === 1 ? LANDSCAPES : ABSTRACTS);
  const pool = (cat as readonly string[]).filter(g => g !== lastGen);
  if (pool.length) {
    
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const allPool = (ALL_GENERATORS as readonly string[]).filter(g => g !== lastGen);
  return allPool[Math.floor(Math.random() * allPool.length)];
}
function getLast(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function setLast(key: string, val: string) { try { localStorage.setItem(key, val); } catch {} }


// --- Performance helpers ---
function estimateThroughput(): number {
  // quick micro-benchmark on offscreen canvas: strokes/ms
  try {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 150;
    const ctx = c.getContext('2d')!;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.globalAlpha = 0.5;
    const N = 1200;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      const x1 = (i % 60) * 5 + 2, y1 = Math.floor(i / 60) * 2 + 1;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + 3, y1 + 1);
      ctx.stroke();
    }
    const t1 = performance.now();
    const ms = Math.max(1, t1 - t0);
    return N / ms; // strokes per ms
  } catch {
    return 10; // reasonable conservative default
  }
}

function thinPlan(plan: PlanResult, maxSegments: number): PlanResult {
  const segs = plan.segments;
  if (segs.length <= maxSegments) return plan;
  const keep = new Array< typeof segs[number] >();
  const ratio = segs.length / maxSegments;
  for (let i = 0; i < segs.length; i++) {
    if (i < maxSegments * 0.6) {
      // keep first 60% densely to preserve main structure
      keep.push(segs[i]);
    } else {
      // probabilistic keep for the rest
      if (Math.random() < 1 / ratio) keep.push(segs[i]);
    }
    if (keep.length >= maxSegments) break;
  }
  return { ...plan, segments: keep };
}

function applyPerformanceBudget(plan: PlanResult, targetMs: number): PlanResult {
  const thr = estimateThroughput();               // strokes/ms
  const budget = Math.floor(thr * targetMs * 0.9); // 90% safety margin
  return thinPlan(plan, Math.max(500, budget));    // never drop below 500 strokes
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<"drawing" | "cooldown">("drawing");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [currentMotif, setCurrentMotif] = useState<string>("");

  const planRef = useRef<PlanResult | null>(null);
  const segIndexRef = useRef(0);
  const rafRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const currentCycleIndexRef = useRef<number | null>(null);
  

  // Retina canvas
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
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = plan.bg;
    ctx.globalAlpha = 1.0;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  // (Re)plan motif and fast-forward drawing to the current moment
  const planAndCatchUp = async () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);

    // Fetch global recipe for this cycle
    let recipe: Recipe | null = null;
    try {
      const r = await fetch(`/api/recipe?i=${info.cycleIndex}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.recipe) recipe = j.recipe as Recipe;
    } catch {}

    // Decide motif via recipe (global) or local rotation (no repeats)
    const lastGen = getLast("randraw_last_gen");
    let motifName = recipe?.generator ?? chooseWithVariety(info.cycleIndex, lastGen);
    setCurrentMotif(motifName);
    setLast("randraw_last_gen", motifName);

    const seed = (recipe?.seed ?? seedForCycle(info.cycleIndex)) >>> 0;
    const rng = makeRng(seed);
    const palette = choosePalette(rng);

    // route generator
    {
      const gen = getGenerator(motifName);
      planRef.current = gen(w, h, seed, palette);
    }

    // background
    paintBg(ctx, planRef.current!);

    // Fast-forward strokes
    const total = planRef.current!.segments.length;
    const target = Math.floor(total * info.progress);
    let i = 0;
    while (i < target) {
      const s = planRef.current!.segments[i++];
      ctx.save();
      ctx.globalAlpha = clamp(s.alpha, 0.02, 0.95);
      ctx.lineWidth = s.w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.restore();
    }
    segIndexRef.current = target;
    setPhase(info.inDrawing ? "drawing" : "cooldown");
    setProgress(info.progress);
    if (!info.inDrawing) setCountdown(Math.ceil(info.cooldownLeft / 1000));
  };

  const drawLoop = async () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const plan = planRef.current!;
    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);

    // New cycle: replan for this cycle
    if (currentCycleIndexRef.current === null || currentCycleIndexRef.current !== info.cycleIndex) {
      // Finish any remaining strokes of the previous plan before switching
      if (currentCycleIndexRef.current !== null && planRef.current) {
        const prevPlan = planRef.current;
        const totalPrev = prevPlan.segments.length;
        let j = segIndexRef.current;
        while (j < totalPrev) {
          const s = prevPlan.segments[j++];
          ctx.save();
          ctx.globalAlpha = clamp(s.alpha, 0.02, 0.95);
          ctx.lineWidth = s.w;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = s.color;
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          ctx.stroke();
          ctx.restore();
        }
        segIndexRef.current = totalPrev;
      }
      currentCycleIndexRef.current = info.cycleIndex;
      await planAndCatchUp();
      rafRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    if (info.inDrawing) {
      setPhase("drawing");
      const total = plan.segments.length;
      const target = Math.floor(total * info.progress);
      let i = segIndexRef.current;
      while (i < target) {
        const s = plan.segments[i++];
        ctx.save();
        ctx.globalAlpha = clamp(s.alpha, 0.02, 0.95);
        ctx.lineWidth = s.w;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.restore();
      }
      segIndexRef.current = i;
      setProgress(info.progress);
    } else {
      // Cooldown: ensure the artwork is fully completed
      setPhase("cooldown");
      // COMPLETE REMAINING ON COOLDOWN
      {
        const total = plan.segments.length;
        let i = segIndexRef.current;
        while (i < total) {
          const s = plan.segments[i++];
          ctx.save();
          ctx.globalAlpha = clamp(s.alpha, 0.02, 0.95);
          ctx.lineWidth = s.w;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = s.color;
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          ctx.stroke();
          ctx.restore();
        }
        segIndexRef.current = total;
      }
      setCountdown(Math.ceil(info.cooldownLeft / 1000));
      
    }

    rafRef.current = requestAnimationFrame(drawLoop);
  };

  useEffect(() => {
    
    (async () => {
      serverOffsetRef.current = await getServerOffsetMs();
      resizeCanvas();
      await planAndCatchUp();
      rafRef.current = requestAnimationFrame(drawLoop);
    })();

    const onResize = () => {
      resizeCanvas();
      // No restart — recompute & fast-forward to current time
      planAndCatchUp();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = Math.floor(progress * 100);

  return (
    <div className="relative w-screen h-screen bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* HUD with brand logo + motif + learning */}
      <div className="absolute top-4 left-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur text-sm leading-tight">
        <div className="flex items-center gap-2">
          <img src="/randraw.png" alt="randraw logo" className="w-6 h-6 rounded-full ring-1 ring-white/20" />
          <div className="font-semibold tracking-wide text-xs text-neutral-200">randraw</div>
        </div>
        <div className="mt-1">
          "Live drawing"
          {currentMotif && <span className="ml-2 text-white/70">· motif: {currentMotif}</span>}
        </div>
        {phase === "drawing" && (
          <>
            <div className="mt-2 w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/70" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-1 text-xs opacity-80">{progressPct}%</div>
          </>
        )}
        
      </div>

      {/* Social: twitter (text) */}
      <div className="absolute top-4 right-4 z-20">
        <a
          href="https://x.com/randrawsol"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow randraw on Twitter"
          title="Follow randraw on Twitter"
          className="inline-flex items-center justify-center px-3 h-10 rounded-full bg-black/50 backdrop-blur ring-1 ring-white/10"
          style={{ textDecoration: "none" }}
        >
          twitter
        </a>
      </div>


      {/* Cooldown overlay */}
      

      <div className="absolute bottom-4 right-4 z-20 text-xs text-white/60">
        randraw · 40s draw · synced globally
      </div>
    </div>
  );
}
