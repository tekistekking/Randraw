// api/recipe.ts
import { kvEnabled, kvGet, kvSet, kvIncr } from "./_kv";

// LCG RNG
function lcg(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function mix(a:number,b:number){ return (Math.imul((a ^ 0x9e37) >>> 0, 2654435761) ^ (b>>>0))>>>0; }
function pick<T>(rng:()=>number, arr:T[]){ return arr[Math.floor(rng()*arr.length)]; }

const EPOCH_ISO = "2024-01-01T00:00:00.000Z";

const SUBJECTS = ["face","flower","tree","house","rocket","fish"] as const;
const LANDSCAPES = ["mountains","city","waves","meadow"] as const;
const ABSTRACTS = ["abstract-flow"] as const;
const CATEGORIES = [SUBJECTS, LANDSCAPES, ABSTRACTS] as const;
type GeneratorKey = typeof SUBJECTS[number] | typeof LANDSCAPES[number] | typeof ABSTRACTS[number];

type Recipe = { i:number; seed:number; generator:GeneratorKey; palette:number; };

function distinctChoice(i:number, prevGen:GeneratorKey | null, stats:Record<string,{pulls:number,rewardSum:number}>|null) {
  // Deterministic baseline: rotate categories to ensure variety
  const catIndex = i % CATEGORIES.length;
  const baseList = CATEGORIES[catIndex] as readonly string[];
  // Derive seed for this cycle
  const seed = mix(i, 0x85ebca6b);
  const rng = lcg(seed);

  // If we have stats, bias towards higher average reward within this category
  let list = [...baseList];
  if (stats) {
    list.sort((a,b) => {
      const sa = stats[a] || {pulls:0, rewardSum:0};
      const sb = stats[b] || {pulls:0, rewardSum:0};
      const ma = sa.pulls ? sa.rewardSum/sa.pulls : 0.5;
      const mb = sb.pulls ? sb.rewardSum/sb.pulls : 0.5;
      return mb - ma;
    });
  }

  // Pick from top 2-3 with randomness for exploration
  const topK = Math.min(3, list.length);
  let candidate = pick(rng, list.slice(0, topK));

  // Ensure we don't repeat previous generator back-to-back
  if (prevGen && candidate === prevGen) {
    // try next best
    candidate = list[(list.indexOf(candidate)+1) % list.length];
    if (candidate === prevGen && list.length > 2) {
      candidate = list[(list.indexOf(candidate)+1) % list.length];
    }
  }
  return candidate as GeneratorKey;
}

export default async function handler(req: any, res: any) {
  const i = Math.max(0, parseInt(String(req.query.i ?? "0"),10) || 0);
  const recipeKey = `randraw:recipe:${i}`;

  // If KV has a recipe cached, return it
  if (kvEnabled()) {
    const cached = await kvGet(recipeKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const count = (await kvGet("randraw:count")) || null;
      return res.status(200).json({ ok: true, recipe: parsed, globalCount: count ? parseInt(count,10) : (i+1) });
    }
  }

  // Gather context: previous generator and bandit stats
  let prevGen: GeneratorKey | null = null;
  let stats: Record<string,{pulls:number,rewardSum:number}> | null = null;

  if (kvEnabled()) {
    const prev = await kvGet(`randraw:recipe:${i-1}`);
    if (prev) { try { prevGen = JSON.parse(prev)?.generator ?? null; } catch {} }
    const bandit = await kvGet("randraw:bandit");
    if (bandit) { try { stats = JSON.parse(bandit); } catch {} }
  }

  // Pick a generator that is distinct from previous, and learning-biased
  const generator = distinctChoice(i, prevGen, stats);

  // Build deterministic palette + seed
  const seed = mix(i, 0x85ebca6b);
  const rng = lcg(seed);
  const palette = Math.floor(rng() * 6) % 6;

  const recipe: Recipe = { i, seed, generator, palette };

  // Persist recipe + increment global count if KV is enabled
  let globalCount = i + 1;
  if (kvEnabled()) {
    await kvSet(recipeKey, JSON.stringify(recipe));
    const c = await kvIncr("randraw:count");
    if (c > 0) globalCount = c;
  }

  return res.status(200).json({ ok: true, recipe, globalCount });
}
