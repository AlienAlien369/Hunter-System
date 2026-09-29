import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../utils/errorReporting';

interface State { error: Error | null }

/** Catches render crashes so one broken page never white-screens the app. */
export default class ErrorBoundary extends Component<{ children: ReactNode; fullPage?: boolean }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { kind: 'render', componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`flex items-center justify-center p-6 ${this.props.fullPage ? 'min-h-screen' : 'py-20'}`} role="alert">
        <div className="max-w-md w-full text-center rounded-2xl border border-red-500/30 bg-[#0d1117]/90 p-6 space-y-4">
          <p className="text-4xl">⚠️</p>
          <p className="font-display text-white tracking-wider">SYSTEM GLITCH</p>
          <p className="text-sm text-gray-400 font-mono">
            Something went wrong on this screen. Your XP and progress are safe — this has been reported.
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-purple-400/50 bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 font-mono text-xs">
              RELOAD
            </button>
            <button type="button" onClick={() => { this.setState({ error: null }); window.location.assign('/'); }}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white font-mono text-xs">
              GO TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    );
  }
}
