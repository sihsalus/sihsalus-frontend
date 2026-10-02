/** WHO 2007 computation.pdf: LMS, with linear tails beyond ±3 for weight-based indicators. */
export interface LMSReference {
  month: number;
  l: number;
  m: number;
  s: number;
}

export function measurementAtZ({ l, m, s }: LMSReference, z: number): number {
  return l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l);
}

export function calculateLMSZScore(
  references: LMSReference[],
  ageInMonths: number,
  measurement: number,
  useRestrictedTails: boolean,
): number | null {
  if (!Number.isFinite(ageInMonths) || !Number.isFinite(measurement) || measurement <= 0) return null;
  const lower = references.find((row) => row.month === Math.floor(ageInMonths));
  const upper = references.find((row) => row.month === Math.ceil(ageInMonths));
  if (!lower || !upper) return null;
  const fraction = ageInMonths - lower.month;
  const row = {
    month: ageInMonths,
    l: lower.l + (upper.l - lower.l) * fraction,
    m: lower.m + (upper.m - lower.m) * fraction,
    s: lower.s + (upper.s - lower.s) * fraction,
  };
  if (row.m <= 0 || row.s <= 0) return null;
  const z =
    row.l === 0 ? Math.log(measurement / row.m) / row.s : ((measurement / row.m) ** row.l - 1) / (row.l * row.s);
  if (!Number.isFinite(z)) return null;
  if (!useRestrictedTails || Math.abs(z) <= 3) return z;
  if (z > 3) {
    const sd3 = measurementAtZ(row, 3);
    return 3 + (measurement - sd3) / (sd3 - measurementAtZ(row, 2));
  }
  const sd3neg = measurementAtZ(row, -3);
  return -3 + (measurement - sd3neg) / (measurementAtZ(row, -2) - sd3neg);
}
