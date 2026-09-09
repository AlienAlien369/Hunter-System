import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Frontend tests only — server tests run via `cd server && npm test` (node:test)
    include: ['src/**/*.test.{ts,tsx}'],
  },
});