import React, { useEffect, useRef, useState } from "react";

/**
 * Autonomous AI Painter
 * - Draws a brand-new generative picture every 60 seconds (full minute)
 * - Shows the live brush process the whole time during the minute
 * - Then gives a 10 second window to download before starting a new one
 * - 100% client-side, no servers or APIs. Deterministic per-seed.
 *
 * Deploy: Vercel-ready (static build). Run `npm run build` then deploy `dist/`.
 * Styling: Tailwind utility classes are used for layout and small UI bits.
 */

const DRAW_MS = 60_000;      // 1 minute drawing time
const COOLDOWN_MS = 10_000;  // 10 seconds to download

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

// Simple seeded RNG (LCG)
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function pick<T>(rng: () => number, arr: T[]) { return arr[Math.floor(rng() * arr.length)]; }

// Soft value-noise via sine stacks (fast and smooth-ish)
function makeNoise2D(seed: number) {
  const rng = createRng(seed);
  const freqs = [
    0.001 + rng() * 0.003,
    0.002 + rng() * 0.004,
    0.004 + rng() * 0.006,
  ];
  const phases = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const sx = [rng() * 1000, rng() * 1000, rng() * 1000];
  const sy = [rng() * 1000, rng() * 1000, rng() * 1000];
  return (x: number, y: number) => {
    let v = 0;
    for (let i = 0; i < 3; i++) {
      v += Math.sin((x + sx[i]) * freqs[i] + phases[i]) * 0.5 + 0.5;
      v += Math.cos((y + sy[i]) * freqs[i] + phases[i]) * 0.5 + 0.5;
    }
    return v / 6; // in [0,1]
  };
}

// Curated palettes (vivid + soft contrasts)
const PALETTES = [
  ["#1b1f3b", "#f9c80e", "#f86624", "#ea3546", "#43bccd"],
  ["#0b132b", "#1c2541", "#5bc0be", "#6fffe9", "#f4f4f8"],
  ["#0b090a", "#e5383b", "#ba181b", "#f5f3f4", "#a4161a"],
  ["#090c08", "#35a7ff", "#ffe74c", "#ff5964", "#6bf178"],
  ["#0a0f0d", "#ff7f11", "#ff1b1c", "#2ec4b6", "#cbf3f0"],
  ["#101419", "#f3a712", "#f6f1d1", "#7798ab", "#d7263d"],
];

type Segment = {
  x1: number; y1: number; x2: number; y2: number;
  w: number; alpha: number; color: string;
};

type Plan = {
  segments: Segment[]; palette: string[]; bg: string; mode: string;
};

/**
 * Pre-plan a large pool of tiny stroke segments and reveal them linearly
 * over the 60s. This guarantees the bot uses the full minute.
 */
function planStrokes({ width, height, seed }: { width: number; height: number; seed: number; }): Plan {
  const rng = createRng(seed);
  const noise = makeNoise2D(seed ^ 0x9e3779b9);
  const palette = pick(rng, PALETTES);

  // composition mode changes the vector field
  const mode = pick(rng, ["orbits", "vines", "eddies", "waves", "petals", "weave"]);

  // number of agents proportional to area, capped for perf
  const areaK = Math.sqrt((width * height) / (1200 * 800));
  const AGENTS = Math.max(6, Math.min(18, Math.floor(8 * areaK)));
  const agentSpeed = 0.6 + rng() * 0.6; // px per sub-step
  const TOTAL_SEGMENTS = Math.floor(12_000 * areaK); // little lines to pre-plan

  const agents = new Array(AGENTS).fill(0).map(() => ({
    x: rng() * width,
    y: rng() * height,
    hueIndex: Math.floor(rng() * palette.length),
    wobble: rng() * 10000,
    life: 200 + Math.floor(rng() * 800),
  }));

  const segments: Segment[] = [];
  let produced = 0;

  const centerX = width / 2;
  const centerY = height / 2;
  const maxR = Math.hypot(centerX, centerY);

  function field(x: number, y: number, k: number) {
    // k in [0,1] across planning; different modes give different flows
    const nx = x / width, ny = y / height;
    const n = noise(x * 0.8 + k * 400, y * 0.8 + k * 300);
    let ang = 0;
    switch (mode) {
      case "orbits": {
        const dx = x - centerX, dy = y - centerY;
        const r = Math.hypot(dx, dy) / (maxR + 1e-6);
        ang = Math.atan2(dy, dx) + (0.6 + n * 0.8) * (1 - r * 0.6);
        break;
      }
      case "vines": {
        ang = Math.sin(nx * 8 + n * 5) + Math.cos(ny * 8 + n * 5);
        break;
      }
      case "eddies": {
        const dx = x - centerX * (0.8 + 0.4 * n);
        const dy = y - centerY * (1.2 - 0.4 * n);
        ang = Math.atan2(dy, dx) + (n - 0.5) * 3.0;
        break;
      }
      case "waves": {
        ang = Math.sin(ny * 10 + n * 6) * 1.4 + 0.2 * Math.sin(nx * 4);
        break;
      }
      case "petals": {
        const dx = x - centerX, dy = y - centerY;
        const r = Math.hypot(dx, dy);
        ang = Math.atan2(dy, dx) + Math.sin(r * 0.02 + n * 8) * 1.2;
        break;
      }
      case "weave":
      default: {
        ang = Math.sin(nx * 12 + n * 4) + Math.cos(ny * 12 + n * 4);
      }
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
      const ang = field(agent.x, agent.y, k) + (rng() - 0.5) * 0.2; // slight jitter
      const dx = Math.cos(ang) * (agentSpeed + rng() * 0.8);
      const dy = Math.sin(ang) * (agentSpeed + rng() * 0.8);
      const x2 = clamp(agent.x + dx, 0, width);
      const y2 = clamp(agent.y + dy, 0, height);

      // brush width/alpha vary smoothly with noise and distance from center
      const cx = agent.x - width / 2, cy = agent.y - height / 2;
      const dist = Math.hypot(cx, cy) / (maxR + 1e-6);
      const softness = 0.6 + (1 - dist) * 0.6; // thicker near center
      const w = 0.6 + softness * (0.6 + noise(agent.x, agent.y) * 2.4); // 0.6..~3.6
      const alpha = 0.15 + 0.3 * (1 - dist) * (0.3 + noise(x2, y2));

      const color = palette[agent.hueIndex];

      // multi-bristle stroke: main + 1~2 hairlines with slight offset
      const hairs = 1 + Math.floor(rng() * 2);

      segments.push({ x1: agent.x, y1: agent.y, x2, y2, w, alpha, color });
      produced++;
      for (let h = 0; h < hairs && produced < TOTAL_SEGMENTS; h++) {
        const jitter = (rng() - 0.5) * (0.6 + rng());
        segments.push({
          x1: agent.x + jitter,
          y1: agent.y - jitter,
          x2: x2 + jitter,
          y2: y2 - jitter,
          w: Math.max(0.4, w * (0.35 + rng() * 0.4)),
          alpha: alpha * (0.35 + rng() * 0.5),
          color,
        });
        produced++;
      }

      agent.x = x2; agent.y = y2;
    }
  }

  // background: soft paper tint from palette lightest color
  const bg = palette[0];

  return { segments, palette, bg, mode };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const [phase, setPhase] = useState<"drawing" | "cooldown">("drawing");
  const [progress, setProgress] = useState(0);    // 0..1 over the minute
  const [countdown, setCountdown] = useState(10); // seconds in cooldown
  const cycleSeedRef = useRef((Date.now() >>> 0));
  const planRef = useRef<Plan | null>(null);
  const segIndexRef = useRef(0);
  const rafRef = useRef(0);
  const startTsRef = useRef(0);

  // Resize canvas to full window with retina scaling
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Start a new draw cycle
  const initCycle = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const seed = (cycleSeedRef.current = (Math.imul((cycleSeedRef.current ^ 0x9e37) >>> 0, 2654435761) >>> 0));

    // Plan strokes for the full minute
    const plan = planStrokes({ width, height, seed });
    planRef.current = plan;

    // Clear and paint soft background
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = plan.bg;
    ctx.globalAlpha = 0.08; // paper-like tint
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    segIndexRef.current = 0;
    setPhase("drawing");
    setProgress(0);
    startTsRef.current = performance.now();

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawLoop);
  };

  // Main animation loop for the minute
  const drawLoop = (now: number) => {
    const canvas = canvasRef.current!;
    const plan = planRef.current!;
    const ctx = canvas.getContext("2d")!;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const elapsed = now - startTsRef.current;
    const p = clamp(elapsed / DRAW_MS, 0, 1);
    setProgress(p);

    // Reveal segments linearly with time
    const total = plan.segments.length;
    const target = Math.floor(total * p);
    let i = segIndexRef.current;

    while (i < target) {
      const s = plan.segments[i];
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
      i++;
    }
    segIndexRef.current = i;

    if (p < 1) {
      rafRef.current = requestAnimationFrame(drawLoop);
    } else {
      // Enter cooldown: allow download for 10s, then auto-restart
      setPhase("cooldown");
      startCooldown();
    }
  };

  const startCooldown = () => {
    // Prepare a download link
    const canvas = canvasRef.current!;

    // Create a blob URL so user can download during cooldown
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = linkRef.current;
      if (a) {
        a.href = url;
        a.download = `autonomous-drawing-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      }
    });

    // 10 second countdown
    setCountdown(Math.floor(COOLDOWN_MS / 1000));
    const started = performance.now();
    function tick() {
      const left = Math.max(0, COOLDOWN_MS - (performance.now() - started));
      setCountdown(Math.ceil(left / 1000));
      if (left > 0) {
        requestAnimationFrame(tick);
      } else {
        resizeCanvas();
        initCycle();
      }
    }
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    resizeCanvas();
    initCycle();

    const onResize = () => {
      // On resize, restart a fresh cycle to keep quality crisp
      resizeCanvas();
      initCycle();
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
      {/* Canvas fills the viewport */}
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* HUD / Status */}
      <div className="absolute top-4 left-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur text-sm leading-tight">
        <div className="flex items-center gap-2">
  <img src="/randraw.png" alt="randraw logo" className="w-6 h-6 rounded-full ring-1 ring-white/20" />
  <div className="font-semibold tracking-wide text-xs text-neutral-200">randraw</div>
</div>
        <div className="mt-1">{phase === "drawing" ? "Live drawing" : "Download window"}</div>
        {phase === "drawing" && (
          <div className="mt-2 w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/70" style={{ width: `${progressPct}%` }} />
          </div>
        )}
        {phase === "drawing" && (
          <div className="mt-1 text-xs opacity-80">{
            `${progressPct}% · next image at ${new Date(Date.now() + (1 - progress) * DRAW_MS).toLocaleTimeString()}`
          }</div>
        )}
        {phase === "cooldown" && (
          <div className="mt-1 text-xs opacity-80">New picture in {countdown}s</div>
        )}
      </div>

      {/* Cooldown overlay with download button */}
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

      {/* Minimal footer branding */}
      <div className="absolute bottom-4 right-4 z-20 text-xs text-white/60">
        randraw · 60s draw · 10s save · loops forever
      </div>
    </div>
  );
}
