import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { configSchema } from '../../config-schema';
import { useOperationalQueueEntries } from '../../hooks/useOperationalQueueEntries';
import useQueueServices from '../../hooks/useQueueService';
import { getQueueEntryDateCriteria } from '../../store/queue-entry-date';
import { useServiceQueuesStore } from '../../store/store';
import { useAverageWaitTime } from '../metrics.resource';
import AverageWaitTimeExtension from './average-wait-time.extension';
import WaitingPatientsExtension from './waiting-patients.extension';

vi.mock('../../hooks/useOperationalQueueEntries', () => ({ useOperationalQueueEntries: vi.fn() }));
vi.mock('../../hooks/useQueueService', () => ({ default: vi.fn() }));
vi.mock('../../store/store', () => ({ useServiceQueuesStore: vi.fn(), updateSelectedService: vi.fn() }));
vi.mock('../metrics.resource', () => ({ useAverageWaitTime: vi.fn() }));

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  vi.mocked(useServiceQueuesStore).mockReturnValue({
    queueLocationSelectionInitialized: true,
    selectedServiceUuid: 'synthetic-service',
    selectedQueueLocationUuid: 'synthetic-upss',
    selectedQueueEntryDate: '2026-10-11',
    selectedAppointmentStatus: '',
    selectedQueueRoomTimestamp: new Date(),
    isPermanentProviderQueueRoom: false,
  });
  vi.mocked(useQueueServices).mockReturnValue({ services: [], isLoading: false, error: undefined } as never);
  vi.mocked(useOperationalQueueEntries).mockReturnValue({
    queueEntries: [],
    isLoading: false,
    error: undefined,
  } as never);
  vi.mocked(useAverageWaitTime).mockReturnValue({
    waitTime: { averageWaitTime: 0 },
    isLoading: false,
    error: undefined,
  } as never);
});

it('applies the same entry day to waiting counts and the native average', () => {
  render(
    <>
      <WaitingPatientsExtension />
      <AverageWaitTimeExtension />
    </>,
  );
  expect(useOperationalQueueEntries).toHaveBeenCalledWith(
    expect.objectContaining({
      service: 'synthetic-service',
      location: 'synthetic-upss',
      isEnded: false,
      ...getQueueEntryDateCriteria('2026-10-11'),
    }),
  );
  expect(useAverageWaitTime).toHaveBeenCalledWith('synthetic-service', expect.any(String), {
    ...getQueueEntryDateCriteria('2026-10-11'),
  });
  expect(screen.getByText('Average service wait · all UPSS')).toBeInTheDocument();
  expect(
    screen.getByText('UPSS filters the list and waiting count. This average includes all UPSS.'),
  ).toBeInTheDocument();
  expect(screen.getAllByText('0')).toHaveLength(2);
});

it.each(['loading', 'error'])('does not report a confirmed zero while %s', (state) => {
  const flags = {
    isLoading: state === 'loading',
    error: state === 'error' ? new Error('Synthetic metric failure') : undefined,
  };
  vi.mocked(useOperationalQueueEntries).mockReturnValue({ queueEntries: [], ...flags } as never);
  vi.mocked(useAverageWaitTime).mockReturnValue({ waitTime: { averageWaitTime: 0 }, ...flags } as never);
  render(
    <>
      <WaitingPatientsExtension />
      <AverageWaitTimeExtension />
    </>,
  );
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(screen.getAllByText('--')).toHaveLength(2);
  if (state === 'error') expect(screen.getAllByText('Queue metrics could not be loaded')).toHaveLength(2);
});

it('rounds fractional average minutes in the all-queues card', () => {
  vi.mocked(useServiceQueuesStore).mockReturnValue({
    ...useServiceQueuesStore(),
    selectedServiceUuid: null,
  });
  vi.mocked(useAverageWaitTime).mockReturnValue({
    waitTime: { averageWaitTime: 12.3456789 },
    isLoading: false,
    error: undefined,
  } as never);
  render(<AverageWaitTimeExtension />);
  expect(screen.getByText('Average queue wait · all UPSS')).toBeInTheDocument();
  expect(screen.getByText('12.3')).toBeInTheDocument();
  expect(screen.queryByText('12.3456789')).not.toBeInTheDocument();
});
