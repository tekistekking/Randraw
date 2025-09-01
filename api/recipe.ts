// api/recipe.ts
// Deterministic global recipe per cycle with variety and increasing difficulty.
// No learning/bandit; we just rotate categories and escalate complexity.

export default async function handler(req: any, res: any) {
  // Helper RNG & mixing
  function lcg(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function mix(a:number,b:number){ return (Math.imul((a ^ 0x9e37) >>> 0, 2654435761) ^ (b>>>0))>>>0; }

  const i = Math.max(0, parseInt(String(req.query.i ?? "0"),10) || 0);

  // Big generator sets (same names as client registry)
  const SUBJECTS = ["face","flower","tree","house","rocket","fish","person","person-field","person-dog","cat","dog","bird","butterfly","bicycle","car","airplane","sailboat","lighthouse","tree-grove"] as const;
  const LANDSCAPES = ["mountains","city","waves","meadow","desert-dunes","canyon","volcano","aurora","forest-path","beach-sunset","snowy-village","waterfall","mountain-cabin","night-city"] as const;
  const ABSTRACTS = ["abstract-flow","mondrian-grid","spiral","voronoi","maze","concentric","starscape"] as const;
  const CATS = [SUBJECTS, LANDSCAPES, ABSTRACTS] as const;

  // Category rotates every cycle; within category we rotate index based on floor(i/3)
  const catIndex = i % CATS.length;
  const list = CATS[catIndex] as readonly string[];
  let idx = Math.floor(i / CATS.length) % list.length;

  // Avoid repeating previous generator (from KV cache if available)
  let prevGen: string | null = null;
  const kvOn = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  async function kvGet(key: string) {
    const url = process.env.KV_REST_API_URL + "/get/" + encodeURIComponent(key);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" }, cache: "no-store" });
    try { const j = await r.json(); return j?.result ?? null; } catch { return null; }
  }
  async function kvSet(key: string, value: string) {
    const url = process.env.KV_REST_API_URL + "/set/" + encodeURIComponent(key) + "/" + encodeURIComponent(value);
    await fetch(url, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" }, cache: "no-store" });
  }
  let recipeKey = `randraw:recipe:${i}`;
  if (kvOn) {
    const prev = await kvGet(`randraw:recipe:${i-1}`);
    if (prev) { try { prevGen = JSON.parse(prev)?.generator ?? null; } catch {} }
  }
  let generator = list[idx];
  if (prevGen === generator) {
    generator = list[(idx + 1) % list.length];
  }

  // Increasing difficulty: every 12 cycles bump a "level". Encode into seed for more complex variants.
  const level = Math.floor(i / 12);
  const seed = mix(i, 0x85ebca6b ^ (level * 0x27d4eb2d));
  const palette = (i * 37 + level * 13) % 6;

  const recipe = { i, seed, generator, palette };
  let globalCount = i + 1;

  if (kvOn) {
    await kvSet(recipeKey, JSON.stringify(recipe));
    // Best-effort count
    try {
      const url = process.env.KV_REST_API_URL + "/incr/" + encodeURIComponent("randraw:count");
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" }, cache: "no-store" });
      const j = await r.json(); if (typeof j?.result === "number") globalCount = j.result;
    } catch {}
  }

  res.status(200).json({ ok: true, recipe, globalCount });
}
