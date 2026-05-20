// Updated useChartLines.ts
import { useMemo } from 'react';

interface DatasetValues {
  [key: string]: number;
}

interface CarbonChartLine {
  group: string;
  date: number;
  value: number;
}

/**
 * Devuelve las líneas de referencia para Carbon Charts,
 * en formato largo: { group, date, value }
 */
export const useChartLines = (
  datasetValues: DatasetValues[],
  keysDataSet: string[],
  startIndex: number,
  _isPercentiles: boolean,
): CarbonChartLine[] => {
  return useMemo(() => {
    const lines: CarbonChartLine[] = [];

    keysDataSet.forEach((key) => {
      datasetValues.forEach((entry, index) => {
        lines.push({
          group: key,
          date: startIndex + index,
          value: entry[key],
        });
      });
    });

    return lines;
  }, [datasetValues, keysDataSet, startIndex]);
};
