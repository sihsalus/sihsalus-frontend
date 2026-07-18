import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { configSchema, type PatientSearchConfig } from './config-schema';
import PatientSearchRootComponent from './root.component';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);

describe('PatientSearchRootComponent', () => {
  beforeEach(() => {
    const defaults = getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig;
    mockUseConfig.mockReturnValue({
      ...defaults,
      search: {
        ...defaults.search,
        showRecentlySearchedPatients: false,
      },
    });
  });

  afterAll(() => {
    window.history.pushState = originalPushState;
  });

  const originalPushState = window.history.pushState;

  it('should render PatientSearchPageComponent when accessing /search', () => {
    window.history.pushState({}, 'Patient Search', 'openmrs/spa/search');
    render(<PatientSearchRootComponent />);

    expect(screen.getByRole('heading', { name: /refine search/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /any/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^male$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /female/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /other/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /unknown/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset fields/i })).toBeInTheDocument();
  });
});
