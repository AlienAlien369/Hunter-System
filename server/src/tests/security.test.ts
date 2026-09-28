/**
 * Unit tests for launch hardening: origin allowlist and rate limiter.
 * Run with: npx tsx --test src/tests/security.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isAllowedOrigin, hit, blockedFor, clearKey } from '../middleware/security.js';

describe('origin allowlist', () => {
  it('allows Hunter frontends and this project\'s Vercel previews only', () => {
    assert.ok(isAllowedOrigin('https://hunters-system.vercel.app'));
    assert.ok(isAllowedOrigin('http://localhost:5173'));
    assert.ok(isAllowedOrigin('https://hunter-system-n4398n9zl-lakshyas-projects-c97e54f6.vercel.app'));
    assert.ok(!isAllowedOrigin('https://evil.example'));
    assert.ok(!isAllowedOrigin('https://hunters-system.vercel.app.evil.example'));
    assert.ok(!isAllowedOrigin('https://hunter-system-x-someone-else.vercel.app'));
  });
});

describe('rate limiter', () => {
  it('blocks after max hits within the window and resets afterwards', () => {
    const k = 'test:' + Math.random();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) assert.strictEqual(hit(k, 3, 60_000, t0), 0);
    assert.strictEqual(blockedFor(k, 3, t0), 60);
    assert.strictEqual(hit(k, 3, 60_000, t0 + 1000), 59);
    assert.strictEqual(blockedFor(k, 3, t0 + 60_000), 0, 'window expired');
    assert.strictEqual(hit(k, 3, 60_000, t0 + 60_000), 0);
    clearKey(k);
    assert.strictEqual(blockedFor(k, 3, t0), 0);
  });
});
