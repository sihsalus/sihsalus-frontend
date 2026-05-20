import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { type ConfigObject, configSchema } from './config-schema';
import Home from './home.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

vi.mock('./helpers/helpers', async () => ({
  ...(await vi.importActual('./helpers/helpers')),
  useSelectedQueueLocationName: vi.fn(() => 'Test Location'),
}));

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  visitQueueNumberAttributeUuid: 'c61ce16f-272a-41e7-9924-4c555d0932c5',
});

describe('Home Component', () => {
  it('renders PatientQueueHeader, ClinicMetrics when activeTicketScreen is not "screen"', () => {
    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/some-path');

    render(<Home />);

    // Assert that the expected components are rendered
    expect(screen.getByTestId('patient-queue-header')).toBeInTheDocument();
    expect(screen.getByTestId('clinic-metrics')).toBeInTheDocument();

    window.history.pushState({}, '', originalPathname || '/');
  });

  it('renders QueueScreen when activeTicketScreen is "screen"', () => {
    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/some-path/screen');

    render(<Home />);
    expect(screen.getByText(/patients currently in queue/i)).toBeInTheDocument();

    window.history.pushState({}, '', originalPathname || '/');
  });
});
