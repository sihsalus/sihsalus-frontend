import React from 'react';
import { getPolygonPoints } from '../poligonPoints/ToothPolygonDesigns';
import './Tooth.css';

interface ToothProps {
  zones: number;
  /** When true, polygons render as transparent outlines only (no fill).
   *  Used to re-stroke the zone lines on top of finding designs so the
   *  tooth structure stays visible when a colored fill design is applied. */
  strokesOnly?: boolean;
}

const Tooth: React.FC<ToothProps> = ({ zones, strokesOnly = false }) => {
  return (
    <svg x="0" y="60" width="60" height="60" viewBox="0 0 20 20" className="tooth">
      {getPolygonPoints(zones).map((points: string, index: number) => (
        <polygon
          key={index}
          points={points}
          fill={strokesOnly ? 'none' : 'white'}
          strokeWidth="0.15"
          stroke="black"
          pointerEvents={strokesOnly ? 'none' : undefined}
          style={{ transition: 'fill 0.3s ease' }}
        />
      ))}
    </svg>
  );
};

export default Tooth;
