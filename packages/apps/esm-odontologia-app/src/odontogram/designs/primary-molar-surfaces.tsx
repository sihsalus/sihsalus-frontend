import type { ComponentType } from 'react';
import { PRIMARY_MOLAR_SURFACES } from '../poligonPoints/ToothPolygonDesigns';

type DesignProps = { strokeColor: string };

/** Reuse the tooth geometry for both filled findings and temporary-restoration outlines. */
function surfaceDesigns(outline: boolean): Record<string, ComponentType<DesignProps>> {
  return Object.fromEntries(
    Object.entries(PRIMARY_MOLAR_SURFACES).map(([number, points]) => [
      number,
      ({ strokeColor }: DesignProps) => (
        <svg x="0" y="60" width="60" height="60" viewBox="0 0 20 20">
          <polygon
            points={points}
            fill={outline ? 'none' : strokeColor}
            stroke={outline ? strokeColor : undefined}
            strokeWidth={outline ? 4 / 3 : undefined}
          />
        </svg>
      ),
    ]),
  );
}

export const primaryFilledSurfaces = surfaceDesigns(false);
export const primaryOutlinedSurfaces = surfaceDesigns(true);

export const Finding36Design3 = ({ strokeColor }: DesignProps) => (
  <svg x="0" y="60" width="60" height="60" viewBox="0 0 20 20">
    <path d="M5,10 H15 M10,5 V10" fill="none" stroke={strokeColor} strokeWidth={4 / 3} />
  </svg>
);

export const Finding36Design4 = ({ strokeColor }: DesignProps) => (
  <svg x="0" y="60" width="60" height="60" viewBox="0 0 20 20">
    <path d="M5,10 H15 M8.333333,5 V15 M11.666667,5 V15" fill="none" stroke={strokeColor} strokeWidth={4 / 3} />
  </svg>
);
