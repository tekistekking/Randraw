
export const config = { runtime: 'edge' };
export default async function handler(req: Request) {
  return new Response(JSON.stringify({ serverNow: Date.now() }), {
    headers: { 'content-type': 'application/json' }
  });
}
