import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Config, configSchema } from '../config-schema';
import { useNationalityConceptAnswers } from './patient-nationality.resource';
import PatientSearchRegistration from './patient-search-registration.component';
import { usePatientSearch } from './usePatientSearch';

vi.mock('./patient-nationality.resource', () => ({
  useNationalityConceptAnswers: vi.fn(),
}));

vi.mock('./usePatientSearch', () => ({
  usePatientSearch: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseNationalityConceptAnswers = vi.mocked(useNationalityConceptAnswers);
const mockUsePatientSearch = vi.mocked(usePatientSearch);
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';

describe('PatientSearchRegistration nationality flow', () => {
  beforeEach(() => {
    const config = getDefaultsFromConfigSchema(configSchema) as Config;
    mockUseConfig.mockReturnValue(config);
    mockUseNationalityConceptAnswers.mockReturnValue({
      data: [
        { uuid: config.patientRegistration.peruNationalityConceptUuid, display: 'Perú' },
        { uuid: colombiaConceptUuid, display: 'Colombia' },
      ],
      error: undefined,
      isLoading: false,
    });
    mockUsePatientSearch.mockReturnValue({
      data: null,
      isLoading: false,
      fetchError: undefined,
      hasMore: false,
      isValidating: false,
      setPage: vi.fn(),
      currentPage: 0,
      totalResults: 0,
    });
  });

  it('assigns, clears, and then allows manually selecting nationality as DNI completeness changes', async () => {
    const user = userEvent.setup();
    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));

    const identifier = screen.getByRole('textbox', { name: /Documento de identidad \(opcional\)/u });
    const nationality = screen.getByRole('combobox', { name: 'Nacionalidad' });

    await user.type(identifier, '12345678');

    await waitFor(() => expect(nationality).toHaveValue('Perú'));
    expect(nationality).toBeDisabled();

    await user.type(identifier, '{Backspace}');

    await waitFor(() => expect(nationality).toHaveValue(''));
    expect(nationality).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByText('Colombia'));

    await waitFor(() => expect(nationality).toHaveValue('Colombia'));
  });
});
