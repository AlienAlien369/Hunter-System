// Static SEO for the landing variants. The app is a single-page app, so
// crawlers and link-preview bots (WhatsApp, X, Slack…) that do not run
// JavaScript only see what is in the HTML. This writes a variant of the built
// index.html with its own title, description, canonical and Open Graph tags,
// plus a plain-text <noscript> summary. Pure functions; tested in
// src/utils/seo.test.ts, which also checks the copy matches the i18n files.

export const SITE = 'https://hunters-system.vercel.app';

// Build-time product name for crawlers that never run JavaScript. The live
// name comes from the platform settings at runtime; set VITE_APP_NAME when
// building after a rename so link previews match.
export const APP_NAME = (typeof process !== 'undefined' && process.env?.VITE_APP_NAME) || 'Hunter System';

// Mirrors landing.meta.* in src/i18n/messages (a test enforces it).
export const VARIANTS = {
  hi: {
    path: '/hi',
    lang: 'hi',
    title: `${APP_NAME} — अपने टाइमटेबल को ऐसा गेम बनाओ जिसे तुम खेलते रहो`,
    description: 'मुफ़्त हैबिट और स्टडी ट्रैकर। अपना दिन बताओ, क्वेस्ट और XP पाओ, E से S तक रैंक चढ़ो, दोस्तों से रेस करो। कोई विज्ञापन नहीं, डेटा की बिक्री नहीं।',
    summary: `${APP_NAME}: मुफ़्त हैबिट और स्टडी ट्रैकर। अपना दिन बताइए, क्वेस्ट और XP पाइए, E से S तक रैंक चढ़िए, दोस्तों से रेस कीजिए। कोई विज्ञापन नहीं, डेटा की बिक्री नहीं। 13 साल या उससे ऊपर के लिए; 18 से कम उम्र में माता-पिता की मंज़ूरी चाहिए।`,
  },
  in: {
    path: '/in',
    lang: 'hi-Latn',
    title: `${APP_NAME} — JEE, NEET, UPSC, GATE aur interviews ke liye study consistency`,
    description: 'JEE, NEET, UPSC, GATE aur interview prep ke liye free study-streak app. Daily plan ko quests aur XP mein badlo. Koi ads nahi, parents ke liye bharosemand.',
    summary: `${APP_NAME}: JEE, NEET, UPSC, GATE aur interview prep ke liye free study-streak app. Apna daily plan quests mein badlo, har poore slot par XP kamao, E se S tak rank chadho. Koi ads nahi, data ki bikri nahi. 13+ umar, 18 se kam mein parent ki approval.`,
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const setMeta = (html, attr, key, value) =>
  html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${esc(value)}$2`);

/** Build the HTML for one landing variant from the built index.html. */
export function buildVariantHtml(indexHtml, v) {
  const url = `${SITE}${v.path}`;
  let out = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${esc(v.title)}</title>`);
  out = setMeta(out, 'name', 'description', v.description);
  out = setMeta(out, 'property', 'og:title', v.title);
  out = setMeta(out, 'property', 'og:description', v.description);
  out = setMeta(out, 'property', 'og:url', url);
  out = setMeta(out, 'name', 'twitter:title', v.title);
  out = setMeta(out, 'name', 'twitter:description', v.description);
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  out = out.replace('<html lang="en">', `<html lang="${v.lang}">`);
  out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><main><h1>${esc(APP_NAME)}</h1><p>${esc(v.summary)}</p></main></noscript>`);
  return out;
}

export function sitemapXml(paths) {
  const rows = paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
