/**
 * Unit tests for the age gate rules.
 * Run with: npx tsx --test src/tests/age.unit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ageFromBirthMonth, canUseApp, classifyAge, initialConsentStatus, isValidEmail, maskEmail, parseBirthMonth } from '../age.js';

const NOW = new Date('2026-10-10T12:00:00Z');
const age = (ym: string) => ageFromBirthMonth(parseBirthMonth(ym, NOW)!, NOW);

describe('birth month parsing', () => {
  it('accepts YYYY-MM and rejects everything else', () => {
    assert.ok(parseBirthMonth('2010-05', NOW));
    for (const bad of ['2010-13', '2010-5', '10-2010', '', null, undefined, 2010, '2010-05-01', '2027-01', '1800-01']) {
      assert.strictEqual(parseBirthMonth(bad, NOW), null, String(bad));
    }
  });
});

describe('age from birth month (youngest-possible rule)', () => {
  it('counts a birthday as passed only once the whole birth month is over', () => {
    assert.strictEqual(age('2008-10'), 17, 'born in October 2008: could turn 18 on Oct 31, not yet on Oct 10');
    assert.strictEqual(age('2008-09'), 18);
    assert.strictEqual(age('2013-10'), 12, 'could turn 13 on Oct 31');
    assert.strictEqual(age('2013-09'), 13);
    assert.strictEqual(age('1990-01'), 36);
  });
});

describe('policy', () => {
  it('blocks under 13, needs consent for 13 to 17, and treats 18+ as adult', () => {
    assert.strictEqual(classifyAge(12), 'blocked');
    assert.strictEqual(classifyAge(13), 'minor');
    assert.strictEqual(classifyAge(17), 'minor');
    assert.strictEqual(classifyAge(18), 'adult');
  });
  it('lets only adults and consented minors use the app', () => {
    assert.strictEqual(initialConsentStatus('minor'), 'pending');
    assert.strictEqual(initialConsentStatus('adult'), 'not_required');
    assert.ok(canUseApp('not_required') && canUseApp('granted'));
    assert.ok(!canUseApp('pending') && !canUseApp('needs_age') && !canUseApp('whatever'));
  });
});

describe('parent email', () => {
  it('validates and masks', () => {
    assert.ok(isValidEmail('mum@example.com'));
    assert.ok(!isValidEmail('mum@example') && !isValidEmail('mum example@x.com') && !isValidEmail(42));
    assert.strictEqual(maskEmail('mum@example.com'), 'm***@example.com');
    assert.ok(!maskEmail('verylongaddress@example.com').includes('erylong'));
  });
});
