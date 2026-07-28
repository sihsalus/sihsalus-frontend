/**
 * ResponsiveOdontogramWrapper
 *
 * Escala el odontograma para que quepa en el ancho disponible.
 *
 * Por qué SVG + foreignObject + viewBox (y no `zoom` ni `transform: scale`):
 *
 *   - Tanto `zoom` como `transform: scale()` crean un nuevo containing-block
 *     para `position: fixed`. Los modales de Carbon (DesignSelector,
 *     ToothInfoModal) usan portal a `document.body` con `position: fixed`,
 *     pero las coordenadas que calculan internamente se ven afectadas por
 *     el escalado del ancestro → terminan renderizando en posiciones
 *     equivocadas cuando el odontograma está reducido.
 *
 *   - SVG con `viewBox` escala de manera NATIVA tanto el rendering visual
 *     como el layout-box, sin crear containing-blocks que interfieran con
 *     `position: fixed`. Los modales portaled a body se ven correctamente
 *     centrados en el viewport.
 *
 *   - `foreignObject` permite incrustar HTML normal (con todos sus eventos,
 *     CSS, flex layout, etc.) dentro del sistema de coordenadas SVG. Las
 *     dimensiones internas se mantienen iguales (60×120 por diente); SVG
 *     escala todo proporcionalmente al ajustar al ancho del contenedor.
 *
 * Soporte de browsers: SVG + foreignObject está soportado en TODOS los
 * navegadores modernos desde hace muchos años (Chrome, Safari, Firefox, Edge).
 */

import React, { useEffect, useRef, useState } from 'react';
import './ResponsiveOdontogramWrapper.css';

interface ResponsiveOdontogramWrapperProps {
  children: React.ReactNode;
  /** Ancho natural (sin escalar) del contenido. Default: 1260 — coincide con
   *  el ancho de la arcada adulta (16 dientes × 60 + 15 spacings × 20). */
  naturalWidth?: number;
}

const ResponsiveOdontogramWrapper: React.FC<ResponsiveOdontogramWrapperProps> = ({ children, naturalWidth = 1260 }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  // Alto inicial estimado para evitar parpadeo en el primer render. Se
  // actualiza al medir el contenido real con ResizeObserver.
  const [naturalHeight, setNaturalHeight] = useState(440);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const update = () => {
      const h = el.scrollHeight;
      if (h > 0) setNaturalHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <svg
      className="responsive-odontogram-svg"
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      preserveAspectRatio="xMidYMin meet"
      // Sin esto, los browsers rendering pueden añadir un baseline-gap
      // como si fuera inline-block.
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <foreignObject x="0" y="0" width={naturalWidth} height={naturalHeight}>
        {/* xmlns hace switch al namespace HTML dentro del SVG para que los
            divs y eventos se comporten como HTML normal. Lo aplicamos vía
            spread porque TypeScript no acepta `xmlns` directamente en un div
            HTML — React igual lo respeta y crea el nodo en el namespace
            correcto. */}
        <div ref={contentRef} {...{ xmlns: 'http://www.w3.org/1999/xhtml' }} style={{ width: naturalWidth }}>
          {children}
        </div>
      </foreignObject>
    </svg>
  );
};

export default ResponsiveOdontogramWrapper;
