import { useMemo } from 'react';

import { type CategoryCodes, type ChartData } from '../data-sets';
import { selectDatasetForCategory } from '../growth-chart-utils';

export function useAppropriateChartData(
  chartDataForGender: ChartData,
  defaultIndicator: string,
  _gender: string,
  childAgeInWeeks: number,
  childAgeInMonths: number,
) {
  const selectedDataset = useMemo(() => {
    const key = defaultIndicator as keyof typeof CategoryCodes;
    return selectDatasetForCategory(chartDataForGender, key, childAgeInWeeks, childAgeInMonths);
  }, [chartDataForGender, childAgeInMonths, childAgeInWeeks, defaultIndicator]);

  return {
    selectedDataset,
  };
}
