export interface ProgramNavigationTarget {
  label?: string;
  programUuid: string;
  chartPath: string;
}

function encodeChartPath(chartPath: string): string {
  return chartPath.replace(/^\/+/, '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export function getProgramNavigationHref(
  patientUuid: string,
  programUuid: string | null | undefined,
  targets: Array<ProgramNavigationTarget> = [],
): string | null {
  if (!patientUuid || !programUuid) {
    return null;
  }

  const target = targets.find((candidate) => candidate.programUuid === programUuid);
  const chartPath = target?.chartPath?.trim();

  if (!chartPath) {
    return null;
  }

  const spaBase = globalThis.spaBase ?? '';
  return `${spaBase}/patient/${patientUuid}/chart/${encodeChartPath(chartPath)}`;
}
