import type { OdontogramData } from '../odontogram/types/odontogram';

/** Total number of clinical findings/solutions stored in an odontogram snapshot. */
export function countSolutions(data?: OdontogramData | null): number {
  if (!data) {
    return 0;
  }
  const teeth = data.teeth.reduce((sum, tooth) => sum + tooth.findings.length, 0);
  const spacing = Object.values(data.spacingFindings ?? {}).reduce(
    (sum, spaces) => sum + spaces.reduce((s, sp) => s + sp.findings.length, 0),
    0,
  );
  const legend = (data.legendSpaces ?? []).reduce((sum, sp) => sum + sp.findings.length, 0);
  return teeth + spacing + legend;
}
