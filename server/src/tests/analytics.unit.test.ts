/**
 * Unit tests for region detection and the analytics allowlist.
 * Run with: npx tsx --test src/tests/analytics.unit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Request } from 'express';
import { detectRegion, regionFromAcceptLanguage } from '../region.js';
import { isClientEvent, sanitizeProps } from '../analytics.js';
import { isAdminUsername } from '../routes/admin.js';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

describe('region detection', () => {
  it('reads the region subtag from Accept-Language', () => {
    assert.strictEqual(regionFromAcceptLanguage('hi-IN,en;q=0.8'), 'IN');
    assert.strictEqual(regionFromAcceptLanguage('en-US,en;q=0.9'), 'US');
    assert.strictEqual(regionFromAcceptLanguage('en'), null);
    assert.strictEqual(regionFromAcceptLanguage('zh-Hans-CN'), 'CN', 'script subtag is skipped');
    assert.strictEqual(regionFromAcceptLanguage(undefined), null);
  });
  it('prefers an explicit choice, then language, then the India timezone', () => {
    assert.strictEqual(detectRegion(req({ 'x-region': 'gb', 'accept-language': 'en-US' })), 'GB');
    assert.strictEqual(detectRegion(req({ 'accept-language': 'en-AE' })), 'AE');
    assert.strictEqual(detectRegion(req({ 'accept-language': 'en', 'x-timezone': 'Asia/Calcutta' })), 'IN');
    assert.strictEqual(detectRegion(req({ 'accept-language': 'en', 'x-timezone': 'Europe/Berlin' })), null);
    assert.strictEqual(detectRegion(req({ 'x-region': 'not-a-region' })), null);
  });
});

describe('analytics allowlist', () => {
  it('lets the browser report page events but never upgrades', () => {
    assert.ok(isClientEvent('landing_view'));
    assert.ok(!isClientEvent('upgrade_completed'));
    assert.ok(!isClientEvent('signup'));
    assert.ok(!isClientEvent(undefined));
  });
  it('keeps only small, boring props', () => {
    assert.deepStrictEqual(sanitizeProps({ page: '/login', ref: 'twitter', email: 'a@b.c', extra: 1 }), { page: '/login', ref: 'twitter' });
    assert.deepStrictEqual(sanitizeProps({ page: 'https://evil.example/x?token=1', ref: 'a b c' }), {});
    assert.deepStrictEqual(sanitizeProps('nope'), {});
  });
});

describe('admin allowlist', () => {
  it('is empty by default and case-insensitive when set', () => {
    const prev = process.env.ADMIN_USERNAMES;
    delete process.env.ADMIN_USERNAMES;
    assert.ok(!isAdminUsername('anyone'));
    process.env.ADMIN_USERNAMES = ' Boss , second ';
    assert.ok(isAdminUsername('boss'));
    assert.ok(isAdminUsername('SECOND'));
    assert.ok(!isAdminUsername('third'));
    assert.ok(!isAdminUsername(undefined));
    if (prev === undefined) delete process.env.ADMIN_USERNAMES; else process.env.ADMIN_USERNAMES = prev;
  });
});
