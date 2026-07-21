import { getDefaultsFromConfigSchema, getGlobalStore, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { type ConfigObject, configSchema } from './config-schema';
import Home from './home.component';
import { type ServiceQueuesState } from './store/store';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  visitQueueNumberAttributeUuid: 'c61ce16f-272a-41e7-9924-4c555d0932c5',
});

describe('Home Component', () => {
  afterEach(() => {
    getGlobalStore<ServiceQueuesState>('serviceQueues').setState({ emergencyUiActive: false });
  });

  it('renders PatientQueueHeader, ClinicMetrics when activeTicketScreen is not "screen"', () => {
    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/some-path');

    render(<Home />);

    // Assert that the expected components are rendered
    expect(screen.getByTestId('patient-queue-header')).toBeInTheDocument();
    expect(screen.getByTestId('clinic-metrics')).toBeInTheDocument();

    window.history.pushState({}, '', originalPathname || '/');
  });

  it('hides the standard metrics and queue table while the emergency UI claims the view', () => {
    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/some-path');

    getGlobalStore<ServiceQueuesState>('serviceQueues').setState({ emergencyUiActive: true });
    render(<Home />);

    expect(screen.getByTestId('patient-queue-header')).toBeInTheDocument();
    expect(screen.queryByTestId('clinic-metrics')).not.toBeInTheDocument();

    window.history.pushState({}, '', originalPathname || '/');
  });
});
