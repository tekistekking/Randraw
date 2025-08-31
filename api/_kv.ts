// api/_kv.ts
export function kvEnabled() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function callKV(path: string, init: RequestInit = {}) {
  const url = process.env.KV_REST_API_URL! + path;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  return j;
}

export async function kvGet(key: string): Promise<string | null> {
  if (!kvEnabled()) return null;
  const j = await callKV(`/get/${encodeURIComponent(key)}`);
  return j?.result ?? null;
}

export async function kvSet(key: string, value: string) {
  if (!kvEnabled()) return;
  await callKV(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
}

export async function kvIncr(key: string): Promise<number> {
  if (!kvEnabled()) return -1;
  const j = await callKV(`/incr/${encodeURIComponent(key)}`);
  return typeof j?.result === "number" ? j.result : -1;
}
