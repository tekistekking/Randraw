import React, { useEffect, useRef, useState } from "react";
import { Brain } from "./brain";
import { planAbstract } from "./abstract";
import { mountains, city, waves, meadow } from "./landscapes";
import { MOTIFS, MotifFn, makeRng, choosePalette, PlanResult } from "./motifs";
import { scoreCanvas } from "./scoring";

// ---- Cycle timing (global) ----
const DRAW_MS = 60_000;          // 60s live drawing
const COOLDOWN_MS = 5_000;      // 10s download window
const CYCLE_MS = DRAW_MS + COOLDOWN_MS;

// Fixed UTC epoch for global sync (same time position everywhere)
const EPOCH_ISO = "2024-01-01T00:00:00.000Z";
const EPOCH_MS = Date.parse(EPOCH_ISO);

// Utils
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const armNames = Object.keys(MOTIFS);

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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const [phase, setPhase] = useState<"drawing" | "cooldown">("drawing");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [currentMotif, setCurrentMotif] = useState<string>("");

  const planRef = useRef<PlanResult | null>(null);
  const segIndexRef = useRef(0);
  const rafRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const currentCycleIndexRef = useRef<number | null>(null);
  const brainRef = useRef<Brain | null>(null);

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
    let recipe: any = null; let globalCount = info.cycleIndex + 1;
    try {
      const r = await fetch(`/api/recipe?i=${info.cycleIndex}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.recipe) { recipe = j.recipe; globalCount = j.globalCount ?? globalCount; }
    } catch {}


    // Decide motif via brain (self-improvement), but deterministically reseed strokes
    const brain = brainRef.current!;
    let motifName = brain.chooseArm();
    if (recipe?.generator) motifName = recipe.generator;
    setCurrentMotif(motifName);

    const seed = recipe?.seed ?? seedForCycle(info.cycleIndex);
    const rng = makeRng(seed);
    const palette = choosePalette(rng);

    // route generator
    if (motifName === "abstract-flow") {
      planRef.current = planAbstract(w, h, seed, palette);
    } else if (motifName === "mountains") {
      planRef.current = mountains(w, h, seed, palette);
    } else if (motifName === "city") {
      planRef.current = city(w, h, seed, palette);
    } else if (motifName === "waves") {
      planRef.current = waves(w, h, seed, palette);
    } else if (motifName === "meadow") {
      planRef.current = meadow(w, h, seed, palette);
    } else {
      const motifFn = MOTIFS[motifName as keyof typeof MOTIFS];
      planRef.current = motifFn(w, h, rng, palette);
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

    // Fetch global recipe for this cycle
    let recipe: any = null; let globalCount = info.cycleIndex + 1;
    try {
      const r = await fetch(`/api/recipe?i=${info.cycleIndex}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.recipe) { recipe = j.recipe; globalCount = j.globalCount ?? globalCount; }
    } catch {}


    // New cycle? evaluate previous, update brain, then replan
    if (currentCycleIndexRef.current === null || currentCycleIndexRef.current !== info.cycleIndex) {
      // evaluate previous only if we actually had a plan
      if (currentCycleIndexRef.current !== null) {
        const reward = scoreCanvas(canvas);
        if (brainRef.current && currentMotif) {
          brainRef.current.update(currentMotif, reward);
          try { await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ i: currentCycleIndexRef.current, generator: currentMotif, reward }) }); } catch {}
        }
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
      // Cooldown: static image, prep download
      setPhase("cooldown");
      setCountdown(Math.ceil(info.cooldownLeft / 1000));
      if (linkRef.current && !linkRef.current.href) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          linkRef.current!.href = url;
          linkRef.current!.download = `randraw-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        });
      }
    }

    rafRef.current = requestAnimationFrame(drawLoop);
  };

  useEffect(() => {
    brainRef.current = new Brain(armNames);
    (async () => {
      serverOffsetRef.current = await getServerOffsetMs();
      resizeCanvas();
      await planAndCatchUp();
      rafRef.current = requestAnimationFrame(drawLoop);
    })();

    const onResize = () => {
      resizeCanvas();
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

      {/* HUD with brand logo + motif + learning stats */}
      <div className="absolute top-4 left-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur text-sm leading-tight">
        <div className="flex items-center gap-2">
          <img src="/randraw.png" alt="randraw logo" className="w-6 h-6 rounded-full ring-1 ring-white/20" />
          <div className="font-semibold tracking-wide text-xs text-neutral-200">randraw</div>
        </div>
        <div className="mt-1">
          {phase === "drawing" ? "Live drawing" : "Download window"}
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
        {phase === "cooldown" && (
          <div className="mt-1 text-xs opacity-80">New picture in {countdown}s</div>
        )}
      
      {/* Painting counter (top-right) */}
      <div className="absolute top-4 right-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur text-sm leading-tight text-white/90">
        <Counter />
      </div>
</div>

      {/* Cooldown overlay */}
      {phase === "cooldown" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="p-6 rounded-2xl bg-neutral-900/90 border border-white/10 shadow-xl text-center">
            <div className="flex flex-col items-center gap-2">
              <img src="/randraw.png" alt="randraw logo" className="w-8 h-8 rounded-full ring-1 ring-white/20" />
              <div className="text-lg font-semibold">Download your artwork</div>
            </div>
            <div className="text-sm opacity-80 mt-1">Starting a new drawing in {countdown}s…</div>
            <a ref={linkRef} href="#" className="inline-block mt-4 px-5 py-2 rounded-xl bg-white text-black font-medium hover:opacity-90 transition-opacity">
              Download PNG
            </a>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-20 text-xs text-white/60">
        randraw · learns every cycle · 60s draw · 10s save
      </div>
    </div>
  );
}

function useGlobalCounter(serverOffsetRef: React.MutableRefObject<number>) {
  const [count, setCount] = React.useState<number>(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = Date.now() + serverOffsetRef.current;
      const sinceEpoch = now - Date.parse(EPOCH_ISO);
      const i = Math.floor(sinceEpoch / (60_000 + 5_000)); // CYCLE_MS
      setCount(i + 1);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return count;
}

function Counter() {
  // @ts-ignore accessing ref from outer scope via global (runtime file scope)
  const count = useGlobalCounter(serverOffsetRef as any);
  return <div className="font-semibold">Paintings: <span className="tabular-nums">{count}</span></div>;
}
