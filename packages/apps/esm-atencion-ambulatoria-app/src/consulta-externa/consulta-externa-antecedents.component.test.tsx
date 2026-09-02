import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { useClinicalEncounter } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { type ConfigObject, configSchema } from '../config-schema';
import ConsultaExternaAntecedents from './consulta-externa-antecedents.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseClinicalEncounter = vi.mocked(useClinicalEncounter);
const mockRequirePrivilege = vi.fn(({ children }: PropsWithChildren) => children);

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: PropsWithChildren<{ privilege: string }>) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useClinicalEncounter: vi.fn(),
}));

vi.mock('../clinical-encounter/summary/out-patient-summary/patient-medical-history.component', () => ({
  default: ({ patientUuid }: { patientUuid: string }) => <div data-patient-uuid={patientUuid}>Medical history</div>,
}));

vi.mock('../clinical-encounter/summary/out-patient-summary/patient-social-history.component', () => ({
  default: ({ patientUuid }: { patientUuid: string }) => <div data-patient-uuid={patientUuid}>Social history</div>,
}));

describe('ConsultaExternaAntecedents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
    mockUseClinicalEncounter.mockReturnValue({
      encounters: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('loads the existing medical and social history behind the history read privilege', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaAntecedents patientUuid="synthetic-patient-uuid" />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:hoja.clinica.historiaSocial' }),
    );
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Medical History', 'Social History']);
    expect(screen.getByText('Medical history')).toHaveAttribute('data-patient-uuid', 'synthetic-patient-uuid');

    await user.click(screen.getByRole('tab', { name: 'Social History' }));
    expect(screen.getByText('Social history')).toHaveAttribute('data-patient-uuid', 'synthetic-patient-uuid');
    expect(mockUseClinicalEncounter).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'synthetic-patient-uuid',
      expect.arrayContaining([expect.any(String)]),
    );
  });
});
