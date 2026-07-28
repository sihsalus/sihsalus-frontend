/**
 * usePinchZoom — custom hook for pinch-to-zoom on touch devices.
 *
 * Attaches native DOM event listeners with { passive: false } so that
 * preventDefault() actually works (React synthetic touch events are passive).
 *
 * All gesture tracking lives in refs to avoid re-renders mid-gesture.
 * Final values are flushed to state on touchEnd.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface PinchZoomOptions {
  /** Minimum effective scale (baseScale × userZoom). Default: 0.2 */
  minScale?: number;
  /** Maximum effective scale. Default: 3 */
  maxScale?: number;
  /** Current base scale from auto-fit. Needed to clamp correctly. */
  baseScale: number;
}

interface PinchZoomState {
  zoom: number;
  panX: number;
  panY: number;
}

export function usePinchZoom({ minScale = 0.2, maxScale = 3, baseScale }: PinchZoomOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PinchZoomState>({ zoom: 1, panX: 0, panY: 0 });

  // Mutable gesture tracking — never triggers re-renders
  const gesture = useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
    startPanX: 0,
    startPanY: 0,
    startMidX: 0,
    startMidY: 0,
    // Live values during gesture (flushed to state on end)
    currentZoom: 1,
    currentPanX: 0,
    currentPanY: 0,
  });

  // Keep baseScale accessible in event handlers without re-attaching
  const baseScaleRef = useRef(baseScale);
  baseScaleRef.current = baseScale;

  const reset = useCallback(() => {
    gesture.current.currentZoom = 1;
    gesture.current.currentPanX = 0;
    gesture.current.currentPanY = 0;
    setState({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  // Reset when baseScale changes (orientation change, resize)
  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function distance(t1: Touch, t2: Touch) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function clampZoom(z: number): number {
      const bs = baseScaleRef.current;
      const minZ = minScale / bs;
      const maxZ = maxScale / bs;
      return Math.max(minZ, Math.min(maxZ, z));
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return;

      const g = gesture.current;
      g.active = true;
      g.startDistance = distance(e.touches[0], e.touches[1]);
      g.startZoom = g.currentZoom;
      g.startPanX = g.currentPanX;
      g.startPanY = g.currentPanY;
      g.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      g.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }

    function onTouchMove(e: TouchEvent) {
      const g = gesture.current;
      if (!g.active || e.touches.length !== 2) return;

      // Prevent page scroll/zoom during pinch
      e.preventDefault();

      const d = distance(e.touches[0], e.touches[1]);
      const ratio = d / g.startDistance;
      const newZoom = clampZoom(g.startZoom * ratio);

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      g.currentZoom = newZoom;
      g.currentPanX = g.startPanX + (midX - g.startMidX);
      g.currentPanY = g.startPanY + (midY - g.startMidY);

      // Apply during gesture for responsiveness
      setState({ zoom: g.currentZoom, panX: g.currentPanX, panY: g.currentPanY });
    }

    function onTouchEnd() {
      const g = gesture.current;
      if (!g.active) return;
      g.active = false;

      // Snap back to 1 if very close
      if (Math.abs(g.currentZoom - 1) < 0.08) {
        g.currentZoom = 1;
        g.currentPanX = 0;
        g.currentPanY = 0;
      }

      // Reset pan when zoom returns to 1
      if (g.currentZoom <= 1) {
        g.currentPanX = 0;
        g.currentPanY = 0;
      }

      setState({ zoom: g.currentZoom, panX: g.currentPanX, panY: g.currentPanY });
    }

    // { passive: false } is critical — allows preventDefault() in onTouchMove
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [minScale, maxScale]);

  return {
    containerRef,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    isZoomed: state.zoom > 1.05,
    reset,
  };
}
