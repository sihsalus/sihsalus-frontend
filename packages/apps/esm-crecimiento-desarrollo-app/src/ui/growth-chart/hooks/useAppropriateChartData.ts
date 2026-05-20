import { useEffect, useRef, useState } from 'react';

import { CategoryCodes, type ChartData, MeasurementTypeCodesLabel, TimeUnitCodes } from '../data-sets';

export function useAppropriateChartData(
  chartDataForGender: ChartData,
  defaultIndicator: string,
  _gender: string,
  childAgeInWeeks: number,
  childAgeInMonths: number,
) {
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CategoryCodes>();
  const [selectedDataset, setSelectedDataset] = useState<string>();

  const selectDatasetForCategoryRef = useRef<(category: keyof typeof CategoryCodes) => void>();
  selectDatasetForCategoryRef.current = (category) => {
    const { datasets } = chartDataForGender[category];

    const isMeasurementType = (xAxis: string) => (Object.values(MeasurementTypeCodesLabel) as string[]).includes(xAxis);

    const isWeeksInRange = (xAxis: string) => xAxis === TimeUnitCodes.weeks && childAgeInWeeks < 13;

    const isMonthsInRange = (xAxis: string, range: { start: number; end: number }) =>
      xAxis === TimeUnitCodes.months && childAgeInMonths >= range.start && childAgeInMonths < range.end;

    const getMaxRangeDataset = () =>
      Object.entries(datasets).reduce((max, [key, value]) =>
        !max || value.metadata.range.end > max[1].metadata.range.end ? [key, value] : max,
      );

    const isAboveRange = (xAxis: string, range: { start: number; end: number }) =>
      xAxis === TimeUnitCodes.months && childAgeInMonths >= range.end;

    Object.entries(datasets).some(([key, value]) => {
      const { xAxisLabel: xAxis, range } = value.metadata;

      if (isMeasurementType(xAxis) || isWeeksInRange(xAxis) || isMonthsInRange(xAxis, range)) {
        setSelectedDataset((prev) => (prev !== key ? key : prev));
        return true;
      }

      if (isAboveRange(xAxis, range)) {
        const [newKey] = getMaxRangeDataset();
        setSelectedDataset(newKey);
        return true;
      }

      return false;
    });
  };

  useEffect(() => {
    if (selectedCategory && chartDataForGender[selectedCategory]) {
      selectDatasetForCategoryRef.current?.(selectedCategory);
    }
  }, [selectedCategory, chartDataForGender]);

  useEffect(() => {
    const key = defaultIndicator as keyof typeof CategoryCodes;
    if (key && chartDataForGender[key]) {
      const newCategory = CategoryCodes[key];
      setSelectedCategory(newCategory);
      const newDataset = Object.keys(chartDataForGender[newCategory].datasets)[0];
      setSelectedDataset(newDataset);
    }
  }, [chartDataForGender, defaultIndicator]);

  return {
    selectedDataset,
    setSelectedDataset,
  };
}
