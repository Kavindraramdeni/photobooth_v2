'use client';

/**
 * ErrorBoundary — catches any unhandled React error in the booth and shows
 * a recovery screen instead of a blank/crashed page mid-event.
 *
 * Usage: wrap <BoothMain /> (or the whole booth page root) with this.
 *
 *   import { BoothErrorBoundary } from '@/components/booth/ErrorBoundary';
 *   <BoothErrorBoundary>
 *     <BoothGuard>
 *       <BoothMain />
 *     </BoothGuard>
 *   </BoothErrorBoundary>
 *
 * Must be a class component — React error boundaries only work as classes.
 * The inner <RecoveryScreen> is a functional component for the UI.
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';

// ── Recovery screen UI ────────────────────────────────────────────────────────
function RecoveryScreen({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  // Auto-retry after 15s so an unattended booth recovers without operator
  // intervention if the error is transient (network blip, etc.)
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center">
      {/* Soft glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, #7c3aed14 0%, transparent 65%)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm">
        {/* Animated emoji */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          🔄
        </motion.div>

        <div>
          <h1 className="text-white font-black text-2xl mb-2">
            Something went wrong
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            The booth hit an unexpected error. Your photos are safe — tap below to restart.
          </p>
        </div>

        {/* Dev-only error details */}
        {isDev && error && (
          <div className="w-full bg-red-950/60 border border-red-800/40 rounded-2xl p-4 text-left">
            <p className="text-red-400 text-xs font-mono break-all leading-relaxed">
              {error.message}
            </p>
          </div>
        )}

        {/* Retry button */}
        <button
          onClick={onRetry}
          className="w-full py-4 rounded-2xl font-bold text-white text-base bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all"
        >
          Restart booth
        </button>

        <p className="text-white/20 text-xs">
          Auto-restarts in 15 seconds if left unattended
        </p>
      </div>
    </div>
  );
}

// ── Class component boundary ───────────────────────────────────────────────────
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class BoothErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so Vercel/Render log viewers catch it
    console.error('[BoothErrorBoundary] Caught error:', error, info.componentStack);

    // Auto-recover after 15s — useful for unattended kiosk mode
    this.retryTimer = setTimeout(() => this.handleRetry(), 15_000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    // Reset React state — this re-mounts the children from scratch
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <RecoveryScreen
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
