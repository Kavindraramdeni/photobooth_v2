'use client';

// Stub — diagnostics are now embedded in admin-event-page.tsx and OperatorPanel.tsx
// This file fixes the build error: pingBackend() returns {ok,latencyMs,timestamp}
// not a raw number, so the old setLatency(ms) call was wrong.
export function DiagnosticsTab({ eventId }: { eventId?: string }) {
  return null;
}
