import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom(): never {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a recovery screen instead of a white screen and reports the crash', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught errors

    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByRole('alert').textContent).toContain('SYSTEM GLITCH');
    expect(screen.getByText('RELOAD')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/client-errors$/);
    expect(JSON.parse(init.body)).toMatchObject({ kind: 'render', message: 'render exploded' });
  });
});
