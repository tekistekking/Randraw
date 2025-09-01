
export const config = { runtime: 'edge' };

function mix(a:number,b:number){ return (Math.imul((a ^ 0x9e37) >>> 0, 2654435761) ^ (b>>>0))>>>0; }

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const iParam = url.searchParams.get('i') ?? "0";
    const i = Math.max(0, parseInt(String(iParam),10) || 0);

    const SUBJECTS = ["person","person-field","lighthouse","sailboat","car","mountain-cabin"] as const;
    const LANDSCAPES = ["mountains","city","waves","meadow"] as const;
    const ABSTRACTS = ["abstract-flow"] as const;
    const CATS = [SUBJECTS, LANDSCAPES, ABSTRACTS] as const;

    const catIndex = i % CATS.length;
    const list = CATS[catIndex] as readonly string[];
    let idx = Math.floor(i / CATS.length) % list.length;
    let generator = list[idx];

    const level = Math.floor(i / 12);
    const seed = mix(i, 0x85ebca6b ^ (level * 0x27d4eb2d));
    const recipe = { i, seed, generator, palette: (i*37 + level*13) % 6, level };

    return new Response(JSON.stringify({ ok: true, recipe, globalCount: i + 1 }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'recipe-failed' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  }
}
