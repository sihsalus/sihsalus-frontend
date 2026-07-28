import { CategoryCodes, DataSetLabels } from '../data-sets';

export interface MeasurementData {
  eventDate: Date;
  dataValues: {
    weight: string;
    height: string;
    headCircumference: string;
  };
}

export function useMeasurementPlotting(
  measurementData: MeasurementData[] | undefined,
  fieldName: string,
  category: string,
  dataset: string,
  dateOfBirth: Date,
  startIndex: number,
) {
  if (!measurementData) return [];

  const isWFLH = category === CategoryCodes.wflh_b || category === CategoryCodes.wflh_g;

  const points = measurementData
    .map((entry) => {
      const y = isWFLH ? parseFloat(entry.dataValues.weight) : parseFloat(entry.dataValues[fieldName]);

      const x = isWFLH
        ? parseFloat(entry.dataValues.height)
        : calculateDecimalDate(entry.eventDate, dataset, dateOfBirth);

      if (x === null || Number.isNaN(Number(x)) || Number.isNaN(y)) return null;

      // Filtrar por rango si corresponde
      if (typeof x === 'number' && dataset !== DataSetLabels.y_2_5 && x < startIndex) {
        return null;
      }

      return { x, y };
    })
    .filter(Boolean) as { x: string | number; y: number }[];

  return [
    {
      id: 'measurementData',
      data: points.map((p) => ({
        date: p.x,
        value: p.y,
        group: 'Paciente',
      })),
      borderWidth: 1.5,
      borderColor: 'rgba(43,102,147,255)',
      pointRadius: 3,
      pointBackgroundColor: 'rgba(43,102,147,255)',
      fill: false,
      borderDash: [5, 5],
    },
  ];
}

function calculateDecimalDate(date: Date | string, dataset: string, dob: Date): number | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  const msDiff = d.getTime() - dob.getTime();

  if (Number.isNaN(msDiff)) return null;

  const days = msDiff / (1000 * 60 * 60 * 24);
  const weeks = days / 7;
  const months = days / 30.44;

  switch (dataset) {
    case DataSetLabels.w_0_13:
      return weeks >= 0 && weeks <= 13 ? parseFloat(weeks.toFixed(2)) : null;
    case DataSetLabels.y_0_2:
      return months >= 0 && months <= 24 ? parseFloat(months.toFixed(2)) : null;
    case DataSetLabels.y_0_5:
    case DataSetLabels.y_2_5:
      return months >= 0 && months <= 60 ? parseFloat(months.toFixed(2)) : null;
    default:
      return null;
  }
}
