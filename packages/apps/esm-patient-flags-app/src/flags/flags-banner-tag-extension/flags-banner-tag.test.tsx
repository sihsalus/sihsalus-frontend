import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient, mockPatientFlags } from 'test-utils';
import { type ConfigObject, configSchema } from '../../config-schema';
import { usePatientFlags } from '../hooks/usePatientFlags';
import FlagsBannerTagExtension from './flags-banner-tag.extension';

const mockUsePatientFlags = vi.mocked(usePatientFlags);
const mockUseConfig = vi.mocked(useConfig);

vi.mock('../hooks/usePatientFlags', async () => {
  const originalModule = await vi.importActual('../hooks/usePatientFlags');

  return {
    ...originalModule,
    usePatientFlags: vi.fn(),
  };
});

beforeEach(() => {
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema<ConfigObject>(configSchema));
});

describe('flags banner tag', () => {
  it('renders the risk flags count in the patient banner and expands the flags list', async () => {
    const user = userEvent.setup();

    mockUsePatientFlags.mockReturnValue({
      flags: mockPatientFlags,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatientFlags>);

    render(<FlagsBannerTagExtension patientUuid={mockPatient.id} />);

    const riskFlagsTag = screen.getByRole('button', { name: /2 risk flags/i });
    expect(riskFlagsTag).toBeInTheDocument();

    await user.click(riskFlagsTag);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/patient needs to be followed up/i)).toBeInTheDocument();
    expect(screen.getByText(/diagnosis for the patient is unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/patient has a future appointment scheduled/i)).toBeInTheDocument();
  });

  it('does not render when there are no risk flags', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema<ConfigObject>(configSchema),
      priorities: [
        { priority: 'risk', color: 'high-contrast', isRiskPriority: false },
        { priority: 'info', color: 'orange', isRiskPriority: false },
      ],
    });

    mockUsePatientFlags.mockReturnValue({
      flags: mockPatientFlags,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatientFlags>);

    render(<FlagsBannerTagExtension patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('button', { name: /risk flags/i })).not.toBeInTheDocument();
  });
});
