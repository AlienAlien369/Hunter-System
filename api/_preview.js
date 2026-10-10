// Shared-profile link previews: swap the generic Open Graph / Twitter tags in
// index.html for the hunter's own (name, rank, level, streak). Pure; tested in
// src/utils/profilePreview.test.ts.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The home page's index.html carries canonical/hreflang/structured data for "/".
// A profile page is a different page: drop those so search engines do not read
// every shared profile as a duplicate of the home page.
const stripHomeSeo = (h) =>
  h
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<link rel="alternate" hreflang[^>]*>/g, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

export function injectProfileMeta(html, p, url) {
  // Unknown or private hunter: still serve the app, but keep this URL out of search results.
  if (!p) return stripHomeSeo(html).replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  const title = `${p.name} · ${p.rank}-Rank Hunter (Level ${p.level})`;
  const streak = p.streak > 0 ? `${p.streak}-day streak, ` : '';
  const desc = `${streak}+${Number(p.weeklyXp).toLocaleString('en-US')} XP this week. Race ${p.name} on Hunter System — turn your day into quests.`;
  const set = (h, attr, key, value) =>
    h.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${esc(value)}$2`);
  let out = stripHomeSeo(html).replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = out.replace('</head>', `    <link rel="canonical" href="${esc(url)}" />\n  </head>`);
  out = set(out, 'property', 'og:title', title);
  out = set(out, 'property', 'og:description', desc);
  out = set(out, 'property', 'og:url', url);
  out = set(out, 'name', 'twitter:title', title);
  out = set(out, 'name', 'twitter:description', desc);
  out = set(out, 'name', 'description', desc);
  return out;
}
