import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS build helper
import { buildVariantHtml, sitemapXml, SITE, VARIANTS } from '../../scripts/seo.mjs';
import { en } from '../i18n/messages/en';
import { hinglish } from '../i18n/messages/hinglish';
import { hi } from '../i18n/messages/hi';

const index = readFileSync('index.html', 'utf8');

describe('landing SEO', () => {
  it('keeps the static India tags identical to the in-app translations', () => {
    expect(VARIANTS.in.title).toBe(hinglish['landing.meta.title.india']);
    expect(VARIANTS.in.description).toBe(hinglish['landing.meta.description.india']);
  });
  it('keeps the static Hindi tags identical to the in-app translations, and builds /hi', () => {
    expect(VARIANTS.hi.title).toBe(hi['landing.meta.title.global']);
    expect(VARIANTS.hi.description).toBe(hi['landing.meta.description.global']);
    const out: string = buildVariantHtml(index, VARIANTS.hi);
    expect(out).toContain('<html lang="hi">');
    expect(out).toContain('<link rel="canonical" href="https://hunters-system.vercel.app/hi"');
    expect(out).toContain(`<title>${VARIANTS.hi.title}</title>`);
  });
  it('home page title and description match the English landing copy', () => {
    // index.html keeps a shorter generic title for the app shell; the description must agree in substance.
    expect(en['landing.meta.title.global']).toContain('Hunter System');
    expect(index).toContain('rel="canonical" href="https://hunters-system.vercel.app/"');
  });
  it('builds /in with its own title, description, canonical and noscript text', () => {
    const out: string = buildVariantHtml(index, VARIANTS.in);
    expect(out).toContain(`<title>${VARIANTS.in.title}</title>`);
    expect(out).toContain(`<meta name="description" content="${VARIANTS.in.description}"`);
    expect(out).toContain('<link rel="canonical" href="https://hunters-system.vercel.app/in"');
    expect(out).toContain('<meta property="og:url" content="https://hunters-system.vercel.app/in"');
    expect(out).toContain('<html lang="hi-Latn">');
    expect(out).toMatch(/<noscript><main><h1>Hunter System<\/h1><p>Hunter System: JEE, NEET, UPSC, GATE/);
    expect(out.match(/rel="canonical"/g)).toHaveLength(1);
  });
  it('declares alternates for the language variants and an image big enough for link previews', () => {
    for (const tag of ['hreflang="x-default"', 'hreflang="en"', 'hreflang="hi"', 'hreflang="hi-Latn"', 'hreflang="en-IN"', 'og:image:width" content="1200"', 'summary_large_image']) expect(index).toContain(tag);
  });
  it('structured data is valid JSON and claims no ratings or reviews', () => {
    const m = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(index)!;
    const ld = JSON.parse(m[1]);
    expect(ld['@type']).toBe('SoftwareApplication');
    expect(ld.offers.price).toBe('0');
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review/i);
  });
  it('mentions no third-party franchise in anything a visitor or crawler sees', () => {
    const everything = [index, JSON.stringify(en), JSON.stringify(hinglish), readFileSync('public/manifest.webmanifest', 'utf8'), readFileSync('public/llms.txt', 'utf8')].join('\n');
    expect(everything).not.toMatch(/solo leveling|jinwoo|shadow monarch/i);
  });
  it('writes a sitemap with absolute URLs', () => {
    const xml: string = sitemapXml(['/', '/in']);
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/in</loc>`);
  });
  it('the shipped sitemap and robots.txt cover the public pages and keep the API and consent links out', () => {
    const sm = readFileSync('public/sitemap.xml', 'utf8');
    for (const p of ['/', '/in', '/hi', '/pricing', '/terms', '/privacy', '/refund']) expect(sm).toContain(`<loc>${SITE}${p}</loc>`);
    const robots = readFileSync('public/robots.txt', 'utf8');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /parent-consent');
    expect(robots).toContain('Sitemap: https://hunters-system.vercel.app/sitemap.xml');
  });
});
