import { describe, expect, it } from 'vitest';
import {
  calculateTpedChronologicalMonthAtDate,
  getEffectiveTpedMilestone,
  getTpedStartingAgeColumn,
  resolveTpedChronologicalMonth,
  resolveTpedEvaluationAgeColumn,
  TPED_AGE_COLUMNS,
  TPED_DEFINITION,
  TPED_INSTRUMENT_ID,
  TPED_LINES,
  TPED_MILESTONES,
  TPED_NORMATIVE_STATUS,
} from './tped-nts087.definition';

describe('TPED NTS 087 instrument definition', () => {
  it('is explicitly versioned and marked as a legacy instrument', () => {
    expect(TPED_INSTRUMENT_ID).toBe('TPED-NTS087-2010');
    expect(TPED_NORMATIVE_STATUS).toBe('legacy');
    expect(TPED_DEFINITION.source).toMatchObject({ annex: 9, instrumentPdfPage: 88 });
  });

  it('contains the 12 normative lines and 88 uniquely coded milestones', () => {
    expect(TPED_LINES.map((line) => line.code)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
    expect(TPED_MILESTONES).toHaveLength(88);
    expect(new Set(TPED_MILESTONES.map((milestone) => milestone.code)).size).toBe(88);
  });

  it('preserves the exact sparse milestone coordinates printed in Annex 9', () => {
    expect(Object.fromEntries(TPED_LINES.map((line) => [line.code, line.milestones.map((item) => item.code)]))).toEqual(
      {
        A: ['A1', 'A3', 'A5', 'A7', 'A18'],
        B: ['B1', 'B3', 'B6'],
        C: ['C1', 'C2', 'C5', 'C10', 'C12', 'C18'],
        D: ['D1', 'D3', 'D4', 'D6', 'D8', 'D11', 'D15', 'D18', 'D21', 'D24', 'D30'],
        E: ['E1', 'E2', 'E3'],
        F: ['F1', 'F3', 'F6'],
        G: ['G1', 'G5', 'G6', 'G9', 'G11', 'G18', 'G21', 'G24', 'G30'],
        H: ['H1', 'H2', 'H5', 'H7', 'H10', 'H12', 'H18', 'H24'],
        I: ['I1', 'I2', 'I3', 'I6', 'I8', 'I11', 'I12', 'I15', 'I18', 'I24', 'I30'],
        J: ['J1', 'J5', 'J6', 'J11', 'J12', 'J18', 'J21', 'J30'],
        K: ['K3', 'K4', 'K5', 'K6', 'K8', 'K11', 'K15', 'K18', 'K21', 'K30'],
        L: ['L1', 'L2', 'L3', 'L6', 'L9', 'L10', 'L11', 'L12', 'L15', 'L18', 'L30'],
      },
    );
  });

  it('uses only the age columns printed in Annex 9', () => {
    expect(TPED_AGE_COLUMNS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24, 30]);

    for (const milestone of TPED_MILESTONES) {
      expect(TPED_AGE_COLUMNS).toContain(milestone.ageMonths);
      expect(milestone.sourcePdfPage).toBeGreaterThanOrEqual(93);
      expect(milestone.sourcePdfPage).toBeLessThanOrEqual(102);
    }
  });

  it('keeps every milestone unmapped until a concept-by-concept audit is complete', () => {
    expect(TPED_MILESTONES.every((milestone) => milestone.conceptUuid === null)).toBe(true);
  });

  it('applies the 28/29-day boundary stated by the historical guide', () => {
    expect(resolveTpedChronologicalMonth(1, 28)).toBe(1);
    expect(resolveTpedChronologicalMonth(1, 29)).toBe(2);
    expect(() => resolveTpedChronologicalMonth(1, 31)).toThrow(RangeError);
  });

  it('calculates chronological months from ISO dates using 30-day normative months', () => {
    expect(calculateTpedChronologicalMonthAtDate('2026-01-01', '2026-01-29')).toBe(0);
    expect(calculateTpedChronologicalMonthAtDate('2026-01-01', '2026-01-30')).toBe(1);
    expect(calculateTpedChronologicalMonthAtDate('2026-01-01', '2026-02-28')).toBe(1);
    expect(calculateTpedChronologicalMonthAtDate('2026-01-01', '2026-03-01')).toBe(2);
  });

  it('rejects invalid or reversed dates', () => {
    expect(calculateTpedChronologicalMonthAtDate('2026-02-30', '2026-03-01')).toBeNull();
    expect(calculateTpedChronologicalMonthAtDate('2026-03-01', '2026-02-28')).toBeNull();
  });

  it.each([
    [0, null],
    [1, 1],
    [12, 12],
    [13, 12],
    [14, 12],
    [15, 15],
    [17, 15],
    [18, 18],
    [20, 18],
    [21, 21],
    [23, 21],
    [24, 24],
    [29, 24],
    [30, 30],
    [31, null],
  ])('maps chronological month %i to evaluation column %s', (chronologicalMonth, expectedColumn) => {
    expect(resolveTpedEvaluationAgeColumn(chronologicalMonth)).toBe(expectedColumn);
  });

  it('starts exploration in the preceding printed column', () => {
    expect(getTpedStartingAgeColumn(1)).toBe(1);
    expect(getTpedStartingAgeColumn(15)).toBe(12);
    expect(getTpedStartingAgeColumn(30)).toBe(24);
  });

  it('inherits the immediately preceding milestone across blank cells', () => {
    expect(getEffectiveTpedMilestone('A', 6)?.code).toBe('A5');
    expect(getEffectiveTpedMilestone('D', 12)?.code).toBe('D11');
    expect(getEffectiveTpedMilestone('H', 30)?.code).toBe('H24');
    expect(getEffectiveTpedMilestone('K', 2)).toBeNull();
  });
});
