import { render, screen } from '@testing-library/react';

import AlturaCuelloChart from './altura-cuello-chart.component';

const chart = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('@carbon/charts-react', async (original) => ({
  ...(await original<typeof import('@carbon/charts-react')>()),
  LineChart: (props) => {
    chart.render(props);
    return <div data-testid="recorded-chart" />;
  },
}));

it('plots only finite, dated patient measurements and exposes them in a table', () => {
  render(
    <AlturaCuelloChart
      patientName="Synthetic patient"
      measurementData={[
        { uuid: 'synthetic-measurement-0', semana: 24, altura: 23, fecha: '2026-06-01T12:00:00Z' },
        { uuid: 'synthetic-measurement-1', semana: 20, altura: 19, fecha: '2026-05-01T12:00:00Z' },
        { uuid: 'synthetic-measurement-2', semana: 25, altura: Number.NaN, fecha: '2026-06-08T12:00:00Z' },
        { uuid: 'synthetic-measurement-3', semana: 0, altura: 0, fecha: '2026-04-01T12:00:00Z' },
        { uuid: 'synthetic-measurement-4', semana: 26, altura: 25, fecha: 'invalid' },
      ]}
    />,
  );
  const { data } = chart.render.mock.calls[0][0];
  expect(data).toEqual([
    { group: 'maternalRecordedMeasurements', week: 20, value: 19 },
    { group: 'maternalRecordedMeasurements', week: 24, value: 23 },
  ]);
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: /Percentiles|Z-Scores/ })).not.toBeInTheDocument();
});

it('does not manufacture a curve when no measurements exist', () => {
  render(<AlturaCuelloChart patientName="Synthetic patient" measurementData={[]} />);
  expect(chart.render).not.toHaveBeenCalled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('noMeasurementDataAvailable')).toBeVisible();
});
