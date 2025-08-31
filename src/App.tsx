import React, { useEffect, useRef, useState } from "react";

// ---- Cycle timing (global) ----
const DRAW_MS = 60_000;          // 60s live drawing
const COOLDOWN_MS = 10_000;      // 10s download window
const CYCLE_MS = DRAW_MS + COOLDOWN_MS;

// Pick any fixed anchor in UTC; all clients reference this
const EPOCH_ISO = "2024-01-01T00:00:00.000Z";
const EPOCH_MS = Date.parse(EPOCH_ISO);

// Utils
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Simple seeded RNG (LCG)
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function pick<T>(rng: () => number, arr: T[]) { return arr[Math.floor(rng() * arr.length)]; }

// Soft-ish 2D noise
function makeNoise2D(seed: number) {
  const rng = createRng(seed);
  const freqs = [0.001 + rng() * 0.003, 0.002 + rng() * 0.004, 0.004 + rng() * 0.006];
  const phases = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const sx = [rng() * 1000, rng() * 1000, rng() * 1000];
  const sy = [rng() * 1000, rng() * 1000, rng() * 1000];
  return (x: number, y: number) => {
    let v = 0;
    for (let i = 0; i < 3; i++) {
      v += Math.sin((x + sx[i]) * freqs[i] + phases[i]) * 0.5 + 0.5;
      v += Math.cos((y + sy[i]) * freqs[i] + phases[i]) * 0.5 + 0.5;
    }
    return v / 6;
  };
}

// Palettes
const PALETTES = [
  ["#1b1f3b", "#f9c80e", "#f86624", "#ea3546", "#43bccd"],
  ["#0b132b", "#1c2541", "#5bc0be", "#6fffe9", "#f4f4f8"],
  ["#0b090a", "#e5383b", "#ba181b", "#f5f3f4", "#a4161a"],
  ["#090c08", "#35a7ff", "#ffe74c", "#ff5964", "#6bf178"],
  ["#0a0f0d", "#ff7f11", "#ff1b1c", "#2ec4b6", "#cbf3f0"],
  ["#101419", "#f3a712", "#f6f1d1", "#7798ab", "#d7263d"],
];

type Segment = { x1:number; y1:number; x2:number; y2:number; w:number; alpha:number; color:string; };
type Plan = { segments: Segment[]; palette: string[]; bg: string; mode: string; };

// Plan strokes deterministically from {width,height,seed}
function planStrokes({ width, height, seed }: { width:number; height:number; seed:number; }): Plan {
  const rng = createRng(seed);
  const noise = makeNoise2D(seed ^ 0x9e3779b9);
  const palette = pick(rng, PALETTES);
  const mode = pick(rng, ["orbits", "vines", "eddies", "waves", "petals", "weave"]);

  const areaK = Math.sqrt((width * height) / (1200 * 800));
  const AGENTS = Math.max(6, Math.min(18, Math.floor(8 * areaK)));
  const agentSpeed = 0.6 + rng() * 0.6;
  const TOTAL_SEGMENTS = Math.floor(12_000 * areaK);

  const agents = new Array(AGENTS).fill(0).map(() => ({
    x: rng() * width,
    y: rng() * height,
    hueIndex: Math.floor(rng() * palette.length),
    life: 200 + Math.floor(rng() * 800),
  }));

  const segments: Segment[] = [];
  let produced = 0;
  const centerX = width / 2, centerY = height / 2;
  const maxR = Math.hypot(centerX, centerY);

  function field(x:number, y:number, k:number) {
    const nx = x / width, ny = y / height;
    const n = noise(x * 0.8 + k * 400, y * 0.8 + k * 300);
    let ang = Math.sin(nx * 12 + n * 4) + Math.cos(ny * 12 + n * 4); // default weave
    if (mode === "orbits") {
      const dx = x - centerX, dy = y - centerY;
      const r = Math.hypot(dx, dy) / (maxR + 1e-6);
      ang = Math.atan2(dy, dx) + (0.6 + n * 0.8) * (1 - r * 0.6);
    } else if (mode === "vines") {
      ang = Math.sin(nx * 8 + n * 5) + Math.cos(ny * 8 + n * 5);
    } else if (mode === "eddies") {
      const dx = x - centerX * (0.8 + 0.4 * n);
      const dy = y - centerY * (1.2 - 0.4 * n);
      ang = Math.atan2(dy, dx) + (n - 0.5) * 3.0;
    } else if (mode === "waves") {
      ang = Math.sin(ny * 10 + n * 6) * 1.4 + 0.2 * Math.sin(nx * 4);
    } else if (mode === "petals") {
      const dx = x - centerX, dy = y - centerY;
      const r = Math.hypot(dx, dy);
      ang = Math.atan2(dy, dx) + Math.sin(r * 0.02 + n * 8) * 1.2;
    }
    return ang;
  }

  while (produced < TOTAL_SEGMENTS) {
    for (let a = 0; a < agents.length && produced < TOTAL_SEGMENTS; a++) {
      const agent = agents[a] as any;
      if (agent.life-- <= 0) {
        agent.x = rng() * width;
        agent.y = rng() * height;
        agent.life = 200 + Math.floor(rng() * 800);
        agent.hueIndex = Math.floor(rng() * palette.length);
      }
      const k = produced / TOTAL_SEGMENTS;
      const ang = field(agent.x, agent.y, k) + (rng() - 0.5) * 0.2;
      const dx = Math.cos(ang) * (agentSpeed + rng() * 0.8);
      const dy = Math.sin(ang) * (agentSpeed + rng() * 0.8);
      const x2 = clamp(agent.x + dx, 0, width);
      const y2 = clamp(agent.y + dy, 0, height);

      const dist = Math.hypot(agent.x - width/2, agent.y - height/2) / (maxR + 1e-6);
      const softness = 0.6 + (1 - dist) * 0.6;
      const w = 0.6 + softness * (0.6 + (noise(agent.x, agent.y) * 2.4));
      const alpha = 0.15 + 0.3 * (1 - dist) * (0.3 + noise(x2, y2));
      const color = palette[agent.hueIndex];

      const hairs = 1 + Math.floor(rng() * 2);
      segments.push({ x1: agent.x, y1: agent.y, x2, y2, w, alpha, color }); produced++;
      for (let h = 0; h < hairs && produced < TOTAL_SEGMENTS; h++) {
        const j = (rng() - 0.5) * (0.6 + rng());
        segments.push({ x1: agent.x + j, y1: agent.y - j, x2: x2 + j, y2: y2 - j,
          w: Math.max(0.4, w * (0.35 + rng() * 0.4)), alpha: alpha * (0.35 + rng() * 0.5), color });
        produced++;
      }

      agent.x = x2; agent.y = y2;
    }
  }

  const bg = palette[0];
  return { segments, palette, bg, mode };
}

// ---- Time sync helpers ----
async function getServerOffsetMs(): Promise<number> {
  try {
    const t0 = Date.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const { serverNow } = await res.json();
    const t1 = Date.now();
    const rtt2 = Math.floor((t1 - t0) / 2);
    return (serverNow + rtt2) - t1; // serverNow ≈ clientNow + offset
  } catch {
    return 0; // fallback to local time
  }
}

function cycleInfo(nowMs: number) {
  const sinceEpoch = nowMs - EPOCH_MS;
  const cycleIndex = Math.floor(sinceEpoch / CYCLE_MS);
  const cycleStart = EPOCH_MS + cycleIndex * CYCLE_MS;
  const into = sinceEpoch - cycleIndex * CYCLE_MS;
  const inDrawing = into < DRAW_MS;
  const p = inDrawing ? clamp(into / DRAW_MS, 0, 1) : 1; // 0..1 during drawing
  const cooldownLeft = inDrawing ? 0 : Math.max(0, CYCLE_MS - into);
  return { cycleIndex, cycleStart, inDrawing, progress: p, cooldownLeft };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const [phase, setPhase] = useState<"drawing" | "cooldown">("drawing");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(10);

  const planRef = useRef<Plan | null>(null);
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

  // Seed for a given cycle (deterministic across browsers)
  const seedForCycle = (i: number) =>
    (Math.imul((i ^ 0x9e37) >>> 0, 2654435761) ^ 0x85ebca6b) >>> 0;

  const paintBg = (ctx: CanvasRenderingContext2D, plan: Plan) => {
    const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = plan.bg;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  // (Re)plan and fast-forward to the current moment
  const planAndCatchUp = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);
    const cycleSeed = seedForCycle(info.cycleIndex);

    // If cycle changed, re-plan; if just resized, re-plan with same seed
    const needReplan = planRef.current === null || currentCycleIndexRef.current !== info.cycleIndex;
    if (needReplan) {
      currentCycleIndexRef.current = info.cycleIndex;
      planRef.current = planStrokes({ width: w, height: h, seed: cycleSeed });
    }
    const plan = planRef.current!;
    paintBg(ctx, plan);

    // Fast-forward draw up to the current target
    const total = plan.segments.length;
    const target = Math.floor(total * info.progress);
    let i = 0;
    while (i < target) {
      const s = plan.segments[i++];
      ctx.save();
      ctx.globalAlpha = clamp(s.alpha, 0.02, 0.9);
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

  const drawLoop = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const plan = planRef.current!;
    const now = Date.now() + serverOffsetRef.current;
    const info = cycleInfo(now);

    // If we crossed into a new cycle, replan and catch up
    if (currentCycleIndexRef.current !== info.cycleIndex) {
      planAndCatchUp();
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
        ctx.globalAlpha = clamp(s.alpha, 0.02, 0.9);
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
      // Cooldown: keep image static, expose download
      setPhase("cooldown");
      setCountdown(Math.ceil(info.cooldownLeft / 1000));

      // Prepare download link once per cooldown
      if (linkRef.current && !linkRef.current.href) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          linkRef.current!.href = url;
          linkRef.current!.download =
            `randraw-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        });
      }
    }

    rafRef.current = requestAnimationFrame(drawLoop);
  };

  useEffect(() => {
    (async () => {
      try {
        // 1) sync to server time
        const offset = await getServerOffsetMs();
        serverOffsetRef.current = offset;
      } catch {
        serverOffsetRef.current = 0;
      }
      // 2) set up canvas and catch up to current time
      resizeCanvas();
      planAndCatchUp();
      // 3) animate from there
      rafRef.current = requestAnimationFrame(drawLoop);
    })();

    const onResize = () => {
      resizeCanvas();
      planAndCatchUp(); // NO restart — recompute & fast-forward to current time
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

      {/* HUD with brand logo */}
      <div className="absolute top-4 left-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur text-sm leading-tight">
        <div className="flex items-center gap-2">
          <img src="/randraw.png" alt="randraw logo" className="w-6 h-6 rounded-full ring-1 ring-white/20" />
          <div className="font-semibold tracking-wide text-xs text-neutral-200">randraw</div>
        </div>
        <div className="mt-1">{phase === "drawing" ? "Live drawing" : "Download window"}</div>
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
        randraw · 60s draw · 10s save · synced globally
      </div>
    </div>
  );
}
