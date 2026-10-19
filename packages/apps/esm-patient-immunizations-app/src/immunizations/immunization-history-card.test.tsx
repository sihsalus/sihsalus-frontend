import { formatDate, parseDate } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { renderWithSwr } from 'test-utils';
import type { ExistingDoses, ImmunizationRecordStatus } from '../types';
import ImmunizationHistoryCard from './immunization-history-card.component';

const dose = (overrides: Partial<ExistingDoses>): ExistingDoses => ({
  immunizationObsUuid: 'synthetic-event',
  occurrenceDateTime: '2025-01-01T12:00:00.000Z',
  doseNumber: 1,
  status: 'completed',
  note: [],
  expirationDate: '',
  nextDoseDate: '2025-02-01T12:00:00.000Z',
  lotNumber: '',
  manufacturer: '',
  ...overrides,
});

const formattedDate = (value: string) => formatDate(parseDate(value), { mode: 'standard', time: false, noToday: true });

describe('Immunization history status', () => {
  it.each<ImmunizationRecordStatus>(['unverified', 'not-done'])(
    'keeps a %s event visible without presenting its next dose as an administered schedule',
    (status) => {
      const event = dose({ status });
      renderWithSwr(
        <ImmunizationHistoryCard
          immunizations={[
            { vaccineUuid: 'synthetic-vaccine', vaccineName: 'Synthetic vaccine', existingDoses: [event] },
          ]}
        />,
      );

      expect(screen.getByText('Synthetic vaccine')).toBeVisible();
      expect(screen.getByText('Dose 1')).toBeVisible();
      expect(screen.getByText(formattedDate(event.occurrenceDateTime))).toBeVisible();
      expect(screen.getByText(status === 'unverified' ? 'Unverified status' : 'No aplicada / diferida')).toBeVisible();
      expect(screen.queryByText(/Next dose:/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Aplicada', { exact: true })).not.toBeInTheDocument();
    },
  );

  it('keeps all events while deriving the next dose only from the latest completed administration', () => {
    const completed = dose({ immunizationObsUuid: 'completed-event' });
    const unverified = dose({
      immunizationObsUuid: 'unverified-event',
      occurrenceDateTime: '2025-03-01T12:00:00.000Z',
      doseNumber: 2,
      status: 'unverified',
      nextDoseDate: '2025-04-01T12:00:00.000Z',
    });
    const deferred = dose({
      immunizationObsUuid: 'deferred-event',
      occurrenceDateTime: '2025-05-01T12:00:00.000Z',
      doseNumber: 3,
      status: 'not-done',
      nextDoseDate: '2025-06-01T12:00:00.000Z',
    });
    renderWithSwr(
      <ImmunizationHistoryCard
        immunizations={[
          {
            vaccineUuid: 'synthetic-vaccine',
            vaccineName: 'Synthetic vaccine',
            existingDoses: [unverified, completed, deferred],
          },
        ]}
      />,
    );

    expect(screen.getByText('Unverified status')).toBeVisible();
    expect(screen.getByText('No aplicada / diferida')).toBeVisible();
    expect(screen.getAllByText(/^Dose \d$/)).toHaveLength(3);
    expect(screen.getByText(/Next dose:/i)).toHaveTextContent(formattedDate(completed.nextDoseDate));
    expect(screen.queryByText(formattedDate(unverified.nextDoseDate))).not.toBeInTheDocument();
    expect(screen.queryByText(formattedDate(deferred.nextDoseDate))).not.toBeInTheDocument();
  });
});
