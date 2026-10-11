import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reasonText } from './reasonText';

describe('reasonText', () => {
  it('translates known server reasons and passes unknown ones through', () => {
    const t = (k: string) => `T:${k}`;
    expect(reasonText(t, 'Minor adjustment')).toBe('T:rr.minor');
    expect(reasonText(t, 'Something new from the server')).toBe('Something new from the server');
  });
  it('every mapped reason still exists in the server rules (so a reworded reason is caught)', () => {
    const server = readFileSync('server/src/rules.ts', 'utf8') + readFileSync('server/src/modules.ts', 'utf8');
    const src = readFileSync('src/components/routine/reasonText.ts', 'utf8');
    const reasons = [...src.matchAll(/^ {2}'(.+?)': 'rr\./gm)].map(m => m[1].replace(/\\'/g, "'"));
    expect(reasons.length).toBeGreaterThan(10);
    for (const r of reasons) expect(server, r).toContain(r);
  });
});
