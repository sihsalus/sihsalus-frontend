import { render, screen, within } from '@testing-library/react';
import ObstetricHistoryChart from './obstetric-history-chart.component';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('shows the recorded zero and distinguishes it from unknown values without inventing a total', () => {
  render(
    <ObstetricHistoryChart
      record={{
        id: 'synthetic-history',
        date: '2026-10-01',
        gravidez: 2,
        partoAborto: 0,
        partoAlTermino: 1,
        partoPrematuro: 1,
        partoNacidoVivo: 2,
      }}
    />,
  );
  const diagram = screen.getByRole('img', { name: /obstetricDiagramTitle/ });
  expect(within(diagram).getByLabelText('abortions: 0')).toBeInTheDocument();
  expect(within(diagram).getByLabelText('births: obstetricNotRecorded')).toBeInTheDocument();
  expect(within(diagram).getByLabelText('obstetricCaesareans: obstetricNotRecorded')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'obstetricDiagramTitle' })).toBeInTheDocument();
});

it('shows vaginal, caesarean, neonatal survival and weight as distinct recorded values', () => {
  render(
    <ObstetricHistoryChart
      record={{
        id: 'synthetic-history',
        date: '2026-10-01',
        partos: 3,
        partosVaginales: 2,
        cesareas: 1,
        partoNacidoMuerto: 0,
        nacidosVivosViven: 2,
        muertePrimeraSemana: 1,
        muerteDespuesPrimeraSemana: 0,
        mayorPesoRn: 3400,
      }}
    />,
  );
  const diagram = screen.getByRole('img', { name: /obstetricDiagramTitle/ });
  for (const label of [
    'births: 3',
    'obstetricVaginalBirths: 2',
    'obstetricCaesareans: 1',
    'stillBirths: 0',
    'obstetricLivingChildren: 2',
    'obstetricFirstWeekDeaths: 1',
    'obstetricLaterDeaths: 0',
  ]) {
    expect(within(diagram).getByLabelText(label)).toBeInTheDocument();
  }
  expect(within(diagram).getByText('3400 g')).toBeInTheDocument();
});
