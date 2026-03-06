/**
 * usePinchZoom.ts
 * Native touch-based pinch-to-zoom hook. Zero dependencies.
 *
 * Usage:
 *   const { scale, translateX, translateY, zoomHandlers, resetZoom } = usePinchZoom();
 *
 *   <div {...zoomHandlers} style={{ overflow: 'hidden', touchAction: 'none' }}>
 *     <img
 *       src={url}
 *       style={{
 *         transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
 *         transformOrigin: 'center center',
 *         transition: scale === 1 ? 'transform 0.3s ease' : 'none',
 *       }}
 *     />
 *   </div>
 */

import { useState, useRef, useCallback } from 'react';

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface ZoomHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface UsePinchZoomReturn extends PinchZoomState {
  zoomHandlers: ZoomHandlers;
  resetZoom: () => void;
  isZoomed: boolean;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function getDistance(t1: React.Touch, t2: React.Touch): number {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function getMidpoint(t1: React.Touch, t2: React.Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export function usePinchZoom(): UsePinchZoomReturn {
  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Refs to track gesture state without causing re-renders mid-gesture
  const lastDistance  = useRef<number | null>(null);
  const lastMidpoint  = useRef<{ x: number; y: number } | null>(null);
  const lastSinglePos = useRef<{ x: number; y: number } | null>(null);
  const currentState  = useRef(state);
  currentState.current = state;

  const resetZoom = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      lastDistance.current  = getDistance(e.touches[0], e.touches[1]);
      lastMidpoint.current  = getMidpoint(e.touches[0], e.touches[1]);
      lastSinglePos.current = null;
    } else if (e.touches.length === 1 && currentState.current.scale > 1) {
      // Pan start (only when zoomed in)
      lastSinglePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // prevent browser scroll/zoom

    if (e.touches.length === 2) {
      // ── Pinch zoom ──────────────────────────────────────────────────────
      const dist    = getDistance(e.touches[0], e.touches[1]);
      const mid     = getMidpoint(e.touches[0], e.touches[1]);

      if (lastDistance.current === null || lastMidpoint.current === null) {
        lastDistance.current = dist;
        lastMidpoint.current = mid;
        return;
      }

      const scaleDelta  = dist / lastDistance.current;
      const { scale, translateX, translateY } = currentState.current;
      const newScale    = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * scaleDelta));

      // Translate to keep pinch midpoint stationary
      const midDeltaX = mid.x - lastMidpoint.current.x;
      const midDeltaY = mid.y - lastMidpoint.current.y;
      const newTranslateX = translateX + midDeltaX / newScale;
      const newTranslateY = translateY + midDeltaY / newScale;

      setState({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
      lastDistance.current = dist;
      lastMidpoint.current = mid;

    } else if (e.touches.length === 1 && lastSinglePos.current && currentState.current.scale > 1) {
      // ── Pan (when zoomed) ───────────────────────────────────────────────
      const dx = e.touches[0].clientX - lastSinglePos.current.x;
      const dy = e.touches[0].clientY - lastSinglePos.current.y;
      const { scale, translateX, translateY } = currentState.current;

      setState(s => ({
        ...s,
        translateX: translateX + dx / scale,
        translateY: translateY + dy / scale,
      }));
      lastSinglePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastDistance.current  = null;
      lastMidpoint.current  = null;
    }
    if (e.touches.length === 0) {
      lastSinglePos.current = null;
      // Snap back to 1 if scaled below minimum
      if (currentState.current.scale < 1.05) {
        setState({ scale: 1, translateX: 0, translateY: 0 });
      }
    }
  }, []);

  return {
    scale:      state.scale,
    translateX: state.translateX,
    translateY: state.translateY,
    isZoomed:   state.scale > 1.05,
    zoomHandlers: { onTouchStart, onTouchMove, onTouchEnd },
    resetZoom,
  };
}
