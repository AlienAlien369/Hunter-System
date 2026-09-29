import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS helper shared with the Vercel function
import { injectProfileMeta } from '../../api/_preview.js';

const html = readFileSync('index.html', 'utf8');
const hunter = { name: 'Shadow<King>', rank: 'B', level: 12, streak: 34, weeklyXp: 1240 };

describe('shared profile link previews', () => {
  it("replaces the generic tags with the hunter's, escaped", () => {
    const out: string = injectProfileMeta(html, hunter, 'https://x.app/h/Shadow');
    expect(out).toContain('<title>Shadow&lt;King&gt; · B-Rank Hunter (Level 12)</title>');
    expect(out).toContain('<meta property="og:title" content="Shadow&lt;King&gt; · B-Rank Hunter (Level 12)"');
    expect(out).toMatch(/og:description" content="34-day streak, \+1,240 XP this week/);
    expect(out).toContain('<meta property="og:url" content="https://x.app/h/Shadow"');
    expect(out).toMatch(/twitter:title" content="Shadow&lt;King&gt;/);
    expect(out).not.toContain('<King>');
  });

  it('leaves the page untouched for private/unknown hunters', () => {
    expect(injectProfileMeta(html, null, 'u')).toBe(html);
  });
});
