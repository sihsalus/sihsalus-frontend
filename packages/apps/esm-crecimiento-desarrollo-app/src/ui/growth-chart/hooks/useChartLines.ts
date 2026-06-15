// Updated useChartLines.ts
import { useMemo } from 'react';

import { type GrowthChartPoint, getReferenceLineXValue } from '../growth-chart-utils';

interface DatasetValues {
  [key: string]: number;
}

/**
 * Devuelve las líneas de referencia para Carbon Charts,
 * en formato largo: { group, date, value }
 */
export const useChartLines = (
  datasetValues: DatasetValues[],
  keysDataSet: string[],
  startIndex: number,
): GrowthChartPoint[] => {
  return useMemo(() => {
    const lines: GrowthChartPoint[] = [];

    keysDataSet.forEach((key) => {
      datasetValues.forEach((entry, index) => {
        lines.push({
          group: key,
          date: getReferenceLineXValue(index, startIndex),
          value: entry[key],
        });
      });
    });

    return lines;
  }, [datasetValues, keysDataSet, startIndex]);
};
