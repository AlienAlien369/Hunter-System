import { injectProfileMeta } from './_preview.js';

const API = process.env.HUNTER_API_URL || 'https://hunter-system-kss0.onrender.com/api';

// GET /h/:name (rewritten here by vercel.json) → the SPA's index.html with the
// hunter's own link-preview tags. Falls back to the plain page if the API is
// slow or the hunter is private, so the page itself always loads.
export default async function handler(req, res) {
  const name = String(req.query.name || '').slice(0, 30);
  const origin = `https://${req.headers.host}`;
  const html = await fetch(`${origin}/index.html`).then((r) => r.text());
  const profile = await fetch(`${API}/public/hunters/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(injectProfileMeta(html, profile, `${origin}/h/${encodeURIComponent(name)}`));
}
