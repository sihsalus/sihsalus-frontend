import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockLocations, mockMetrics, mockServiceTypes, mockSession } from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';

import ClinicMetrics from './clinic-metrics.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLocations = vi.mocked(useLocations);
const mockUseSession = vi.mocked(useSession);

vi.mock('./queue-metrics.resource', async () => ({
  ...(await vi.importActual('./queue-metrics.resource')),
  useServiceMetricsCount: vi.fn().mockReturnValue(5),
}));

vi.mock('../hooks/useQueues', async () => {
  return {
    useQueues: vi.fn().mockReturnValue({ queues: mockServiceTypes.data }),
  };
});

vi.mock('./clinic-metrics.resource', async () => ({
  ...(await vi.importActual('./clinic-metrics.resource')),
  useActiveVisits: vi.fn().mockReturnValue({
    activeVisitsCount: mockMetrics.activeVisitsCount,
  }),
  useAverageWaitTime: vi.fn().mockReturnValue({ waitTime: mockMetrics.waitTime }),
}));

vi.mock('../helpers/helpers', async () => ({
  ...(await vi.importActual('../helpers/helpers')),
  useSelectedServiceName: vi.fn().mockReturnValue('All'),
}));

describe('Clinic metrics', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
    });
    mockUseLocations.mockReturnValue(mockLocations.data.results);
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('renders a dashboard outlining metrics from the outpatient clinic', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      visitQueueNumberAttributeUuid: 'c61ce16f-272a-41e7-9924-4c555d0932c5',
    });

    mockOpenmrsFetch.mockResolvedValue({ data: mockMetrics } as unknown as FetchResponse);

    render(<ClinicMetrics />);

    await screen.findByText(/Checked in patients/i);
    expect(screen.getByText(/100/i)).toBeInTheDocument();
    expect(screen.getAllByText(/patient list/i));
    expect(screen.getByText(/Average wait time today/i)).toBeInTheDocument();
    expect(screen.getByText(/minutes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /queue screen/i })).toBeInTheDocument();
    expect(screen.getByText(/69/i)).toBeInTheDocument();
  });
});
