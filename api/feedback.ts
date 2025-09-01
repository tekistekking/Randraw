// api/feedback.ts
import { kvEnabled, kvGet, kvSet } from "./_kv";

type Body = { i:number; generator:string; reward:number };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
  const { i, generator, reward } = (req.body || {}) as Body;
  if (typeof i !== "number" || typeof generator !== "string" || typeof reward !== "number") {
    return res.status(400).json({ ok:false, error:"invalid body" });
  }

  if (!kvEnabled()) {
    // No KV configured; accept but do nothing server-side
    return res.status(200).json({ ok:true, stored:false });
  }

  const key = "randraw:bandit";
  const raw = await kvGet(key);
  const stats = raw ? JSON.parse(raw) : {};
  const s = stats[generator] || { pulls: 0, rewardSum: 0 };
  s.pulls += 1;
  s.rewardSum += Math.max(0, Math.min(1, reward));
  stats[generator] = s;
  await kvSet(key, JSON.stringify(stats));

  return res.status(200).json({ ok:true, stored:true });
}
