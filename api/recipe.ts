// api/recipe.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kvEnabled, kvGet, kvSet, kvIncr } from "./_kv";

// Deterministic RNG (LCG)
function lcg(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function mix(a:number,b:number){ return (Math.imul((a ^ 0x9e37) >>> 0, 2654435761) ^ (b>>>0))>>>0; }
function pick<T>(rng:()=>number, arr:T[]){ return arr[Math.floor(rng()*arr.length)]; }

const EPOCH_ISO = "2024-01-01T00:00:00.000Z";
const CATEGORY_KEYS = ["subject","landscape","abstract"] as const;
const GENERATORS = [
  // subjects
  { key: "face", cat: "subject" },
  { key: "flower", cat: "subject" },
  { key: "tree", cat: "subject" },
  { key: "house", cat: "subject" },
  { key: "rocket", cat: "subject" },
  { key: "fish", cat: "subject" },
  // landscapes
  { key: "mountains", cat: "landscape" },
  { key: "city", cat: "landscape" },
  { key: "waves", cat: "landscape" },
  { key: "meadow", cat: "landscape" },
  // abstract
  { key: "abstract-flow", cat: "abstract" },
] as const;

type GeneratorKey = typeof GENERATORS[number]["key"];
type Recipe = { i:number; seed:number; generator:GeneratorKey; palette:number; };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const i = Math.max(0, parseInt(String(req.query.i ?? "0"),10) || 0);
  const recipeKey = `randraw:recipe:${i}`;

  // Try KV recipe first
  if (kvEnabled()) {
    const existing = await kvGet(recipeKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      const count = (await kvGet("randraw:count")) || null;
      return res.status(200).json({ ok: true, recipe: parsed, globalCount: count ? parseInt(count,10) : (i+1) });
    }
  }

  // Build a deterministic, but unique, recipe for this cycle
  const globalSalt = 0x85ebca6b;
  const seed = mix(i, globalSalt);
  const rng = lcg(seed);

  // pick generator using rough weights; could be shaped by KV bandit later
  const gen = pick(rng, Array.from(GENERATORS));
  const palette = Math.floor(rng() * 6) % 6;

  const recipe: Recipe = { i, seed, generator: gen.key as GeneratorKey, palette };

  // Persist + increment global count if KV is available
  let globalCount = i + 1;
  if (kvEnabled()) {
    await kvSet(recipeKey, JSON.stringify(recipe));
    const c = await kvIncr("randraw:count");
    if (c > 0) globalCount = c;
  }

  return res.status(200).json({ ok: true, recipe, globalCount });
}
