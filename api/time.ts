
export default async function handler(req: any, res: any) {
  res.status(200).json({ serverNow: Date.now() });
}
