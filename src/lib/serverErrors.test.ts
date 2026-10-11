import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SERVER_ERRORS, serverErrorText } from './serverErrors';
import { useLocaleStore, loadLocale } from '../i18n';

describe('server error messages', () => {
  it('every mapped message still exists on the server', () => {
    const server = ['auth', 'consent', 'payLinks'].map(f => readFileSync(`server/src/routes/${f}.ts`, 'utf8')).join('\n')
      + readFileSync('server/src/middleware/security.ts', 'utf8');
    for (const msg of Object.keys(SERVER_ERRORS)) expect(server, msg).toContain(msg);
  });
  it('translates in Hindi and passes unknown messages through', async () => {
    await loadLocale('hi');
    useLocaleStore.setState({ locale: 'hi' });
    expect(serverErrorText('Invalid credentials')).toMatch(/[\u0900-\u097F]/);
    expect(serverErrorText('A brand new message')).toBe('A brand new message');
    useLocaleStore.setState({ locale: 'en' });
    expect(serverErrorText('Invalid credentials')).toBe('Invalid credentials');
  });
});
