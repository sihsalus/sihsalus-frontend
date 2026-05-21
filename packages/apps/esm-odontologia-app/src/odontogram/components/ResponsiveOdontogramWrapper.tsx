/**
 * ResponsiveOdontogramWrapper
 *
 * Scales the teeth visualization to fit the available container width.
 * On touch devices, supports pinch-to-zoom via the usePinchZoom hook.
 *
 * Design decisions:
 *  - CSS transform: scale() preserves all internal SVG dimensions and proportions.
 *  - ResizeObserver auto-adjusts on orientation change or container resize.
 *  - Pinch zoom uses native DOM listeners (not React synthetic events) so that
 *    preventDefault() works correctly to block page-level zoom during the gesture.
 *  - Normal vertical scrolling is NOT blocked — only two-finger pinch is intercepted.
 *  - Modals (position: fixed) are unaffected by the transform.
 */

import React, { useEffect, useRef, useState } from 'react';
import { usePinchZoom } from './usePinchZoom';
import './ResponsiveOdontogramWrapper.css';

interface ResponsiveOdontogramWrapperProps {
  children: React.ReactNode;
  /** Natural (unscaled) pixel width of the content. Default: 1260 */
  naturalWidth?: number;
}

const ResponsiveOdontogramWrapper: React.FC<ResponsiveOdontogramWrapperProps> = ({ children, naturalWidth = 1260 }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  const { containerRef, zoom, panX, panY, isZoomed, reset } = usePinchZoom({
    baseScale,
    minScale: 0.2,
    maxScale: 3,
  });

  // --- Auto-fit: observe container width ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setBaseScale(Math.min(w / naturalWidth, 1));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, containerRef]);

  // --- Track content height so the container doesn't collapse ---
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const update = () => setContentHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveScale = baseScale * zoom;
  const scaledHeight = contentHeight * effectiveScale;

  return (
    <div
      ref={containerRef}
      className="responsive-odontogram-viewport"
      // The inner content uses CSS `transform: scale()` which DOES NOT shrink
      // its layout box height — only its visual rendering. If we set only
      // min-height, the viewport grows to the unscaled content height and a
      // big vertical gap appears below the scaled visual. Fixing `height` to
      // the visual `scaledHeight` (combined with `overflow: hidden` from CSS)
      // clips the layout overflow and removes the gap.
      style={{ height: scaledHeight > 0 ? scaledHeight : undefined }}
    >
      {isZoomed && (
        <div className="responsive-odontogram-zoom-badge">
          {Math.round(effectiveScale * 100)}%
          <button type="button" onClick={reset} className="responsive-odontogram-zoom-reset">
            Reset
          </button>
        </div>
      )}

      <div
        ref={contentRef}
        className="responsive-odontogram-content"
        style={{
          width: naturalWidth,
          transform: `translate(${panX}px, ${panY}px) scale(${effectiveScale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ResponsiveOdontogramWrapper;
