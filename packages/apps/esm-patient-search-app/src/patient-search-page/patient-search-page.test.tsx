import { getDefaultsFromConfigSchema, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { configSchema, type PatientSearchConfig } from '../config-schema';

import PatientSearchPageComponent from './patient-search-page.component';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseLayoutType = vi.mocked(useLayoutType);

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => ({
    page: 1,
  })),
  useLocation: vi.fn(),
  useSearchParams: vi.fn(() => [
    {
      get: vi.fn(() => 'John'),
    },
  ]),
}));

describe('PatientSearchPageComponent', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig);
  });

  it('should render advanced search component on desktop layout', () => {
    render(<PatientSearchPageComponent />);

    const searchBtn = screen.getByRole('button', { name: /^search$/i });
    const resetBtn = screen.getByRole('button', { name: /reset/i });

    expect(searchBtn).toBeInTheDocument();
    expect(resetBtn).toBeInTheDocument();
  });

  it('should render patient search overlay on tablet layout', () => {
    mockUseLayoutType.mockReturnValue('tablet');
    render(<PatientSearchPageComponent />);

    const searchBtn = screen.getByRole('button', { name: /^search$/i });
    expect(searchBtn).toBeInTheDocument();
  });
});
