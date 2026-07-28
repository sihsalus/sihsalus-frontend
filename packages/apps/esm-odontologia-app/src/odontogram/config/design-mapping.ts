import {
  Finding1Design1,
  Finding1Design2,
  Finding1Design3,
  Finding1Design4,
  Finding1Design5,
  Finding1Design6,
  Finding2Design1,
  Finding2Design2,
  Finding13Design1,
  Finding13Design2,
  Finding24Design1,
  Finding24Design2,
  Finding25Design1,
  Finding25Design2,
  Finding26Design1,
  Finding30Design1,
  Finding30Design2,
  Finding30Design3,
  Finding30Design4,
  Finding30Design5,
  Finding30Design6,
  Finding39Design1,
  Finding39Design2,
  Finding39Design3,
  TwoHorizontalLines20x20,
  TwoHorizontalLines60x20,
} from '../designs/figuras';

export interface DesignMapping {
  [optionId: number]: {
    [designNumber: number]: React.ComponentType<{ strokeColor: string }>;
  };
}

// Single source of truth for design components. Lower-arch rendering is
// derived from these by wrapping in a vertical mirror transform at the call
// site (see MainSectionOnTheCanvas, SpacingFinding). Pre-baked Inverted
// variants used to live in a parallel mapping and have been dropped because
// they were drawn manually and risked drifting from the upper canon.
export const DESIGN_MAPPING: DesignMapping = {
  1: {
    1: Finding1Design1,
    2: Finding1Design2,
    3: Finding1Design3,
  },
  2: {
    1: Finding2Design1,
    2: Finding2Design1,
    3: Finding2Design1,
  },
  13: {
    1: Finding13Design1,
    2: Finding13Design2,
  },
  24: {
    1: Finding24Design1,
    2: Finding24Design2,
  },
  25: {
    1: Finding25Design1,
    2: Finding25Design2,
  },
  26: {
    1: Finding26Design1,
  },
  30: {
    1: Finding30Design3,
    2: Finding30Design1,
    3: Finding30Design2,
  },
  31: {
    1: TwoHorizontalLines60x20,
    2: TwoHorizontalLines60x20,
    3: TwoHorizontalLines60x20,
  },
  32: {
    1: TwoHorizontalLines60x20,
    2: TwoHorizontalLines60x20,
    3: TwoHorizontalLines60x20,
  },
  39: {
    1: Finding39Design2,
    2: Finding39Design3,
    3: Finding39Design1,
  },
};

export const getDesignComponent = (optionId: number, designNumber: number) => {
  return DESIGN_MAPPING[optionId]?.[designNumber];
};

/** Findings whose design carries glyph/text content (e.g. the "S" in finding
 *  26 — Pieza dentaria supernumeraria). These must NOT be vertically mirrored
 *  for lower teeth because the glyph would render upside-down. They render
 *  identically for both arches. */
const ORIENTATION_AGNOSTIC_FINDINGS = new Set<number>([26]);

export const isOrientationAgnosticFinding = (optionId: number): boolean => {
  return ORIENTATION_AGNOSTIC_FINDINGS.has(optionId);
};

/** Selecciona el diseño de 60px (tooth cells). The position parameter is
 *  retained for API compatibility but no longer affects the lookup — the
 *  caller is responsible for applying a vertical mirror transform when
 *  rendering on a lower tooth. */
export const getDesignComponentByPosition = (
  optionId: number,
  designNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isLowerTeeth: boolean = false,
) => {
  return DESIGN_MAPPING[optionId]?.[designNumber];
};

// =============================================================================
// SPACING DESIGN MAPPING — 20px designs for spacing cells between teeth
// =============================================================================

/**
 * Mapeo de diseños para celdas de spacing (20px).
 * Estos son diferentes a los de 60px para findings 1, 2, 30, 31, 32, 39.
 */
export const SPACING_DESIGN_MAPPING: DesignMapping = {
  1: {
    1: Finding1Design5, // line going left
    2: Finding1Design4, // line going right
    3: Finding1Design6, // straight through (both sides)
  },
  2: {
    1: Finding2Design2,
    2: Finding2Design2,
    3: Finding2Design2,
  },
  // 13: no 20px designs (empty placeholder)
  24: {
    1: Finding24Design1,
    2: Finding24Design2,
  },
  25: {
    1: Finding25Design1,
    2: Finding25Design2,
  },
  26: {
    1: Finding26Design1,
  },
  30: {
    1: Finding30Design4,
    2: Finding30Design6,
    3: Finding30Design5,
  },
  31: {
    1: TwoHorizontalLines20x20,
    2: TwoHorizontalLines20x20,
    3: TwoHorizontalLines20x20,
  },
  32: {
    1: TwoHorizontalLines20x20,
    2: TwoHorizontalLines20x20,
    3: TwoHorizontalLines20x20,
  },
  39: {
    1: Finding39Design1,
    2: Finding39Design1,
    3: Finding39Design1,
  },
};

/** Selecciona el diseño de 20px (spacing cells). The position parameter is
 *  retained for API compatibility but no longer affects the lookup — the
 *  caller is responsible for applying a vertical mirror transform when
 *  rendering on a lower-tooth space. */
export const getSpacingDesignComponentByPosition = (
  optionId: number,
  designNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isLowerTeeth: boolean = false,
) => {
  return SPACING_DESIGN_MAPPING[optionId]?.[designNumber];
};
