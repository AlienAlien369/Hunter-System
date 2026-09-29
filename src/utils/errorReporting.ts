// Send client crashes to the server logs (POST /api/client-errors) so launch
// issues are visible in Render. Deduplicated and capped per page session.

const sent = new Set<string>();
const MAX_REPORTS = 10;

function apiBase(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env) return env;
  const host = window.location.hostname;
  if (host.includes('vercel.app')) return 'https://hunter-system-kss0.onrender.com/api';
  if (host.includes('onrender.com')) return '/api';
  return 'http://localhost:3000/api';
}

export function reportError(error: unknown, extra: { kind?: string; componentStack?: string } = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${err.message}|${extra.kind ?? ''}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS) return;
    sent.add(key);
    const body = JSON.stringify({
      kind: extra.kind ?? 'error',
      message: err.message || 'Unknown error',
      stack: err.stack,
      componentStack: extra.componentStack,
      url: window.location.pathname,
    });
    fetch(`${apiBase()}/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // reporting must never throw
  }
}

/** Capture uncaught errors and unhandled promise rejections. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', e => reportError(e.error ?? e.message, { kind: 'uncaught' }));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, { kind: 'promise' }));
}
