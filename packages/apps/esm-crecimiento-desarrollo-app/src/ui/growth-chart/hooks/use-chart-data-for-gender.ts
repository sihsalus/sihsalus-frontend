import { useMemo } from 'react';

import type { ChartData } from '../data-sets';

export function useChartDataForGender(gender: string, chartData: ChartData = {}) {
  const chartDataForGender = useMemo(() => {
    return Object.fromEntries(
      Object.entries(chartData).filter(([, value]) => value?.categoryMetadata?.gender === gender),
    );
  }, [gender, chartData]);

  return { chartDataForGender };
}
