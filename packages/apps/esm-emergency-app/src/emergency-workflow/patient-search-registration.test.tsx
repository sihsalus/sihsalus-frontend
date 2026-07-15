import { getDefaultsFromConfigSchema, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Config, configSchema } from '../config-schema';
import {
  EmergencyPatientRegistrationAmbiguousError,
  prepareEmergencyPatientIdentifier,
  saveEmergencyPatient,
} from '../resources/patient-registration.resource';
import { useNationalityConceptAnswers } from './patient-nationality.resource';
import PatientSearchRegistration from './patient-search-registration.component';
import { usePatientSearch } from './usePatientSearch';

vi.mock('./patient-nationality.resource', () => ({
  useNationalityConceptAnswers: vi.fn(),
}));

vi.mock('./usePatientSearch', () => ({
  usePatientSearch: vi.fn(),
}));

vi.mock('../resources/patient-registration.resource', () => ({
  prepareEmergencyPatientIdentifier: vi.fn(),
  saveEmergencyPatient: vi.fn(),
  EmergencyPatientRegistrationAmbiguousError: class EmergencyPatientRegistrationAmbiguousError extends Error {},
  EmergencyPatientRegistrationVerificationError: class EmergencyPatientRegistrationVerificationError extends Error {},
}));

const mockUseConfig = vi.mocked(useConfig<Config>);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockPrepareEmergencyPatientIdentifier = vi.mocked(prepareEmergencyPatientIdentifier);
const mockSaveEmergencyPatient = vi.mocked(saveEmergencyPatient);
const mockUseNationalityConceptAnswers = vi.mocked(useNationalityConceptAnswers);
const mockUsePatientSearch = vi.mocked(usePatientSearch);
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';

describe('PatientSearchRegistration nationality flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
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
    mockPrepareEmergencyPatientIdentifier.mockResolvedValue('100TEST');
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

  it.each([
    [
      'while the catalog is loading',
      { data: undefined, error: undefined, isLoading: true },
      'Cargando nacionalidades...',
    ],
    [
      'when the catalog request fails',
      { data: undefined, error: new Error('GET /ws/rest/v1/concept failed'), isLoading: false },
      'No se pudo cargar el catálogo de nacionalidades',
    ],
    [
      'when the catalog does not contain Peru',
      { data: [{ uuid: colombiaConceptUuid, display: 'Colombia' }], error: undefined, isLoading: false },
      'No se puede validar la nacionalidad requerida con el catálogo disponible. Contacte al administrador.',
    ],
  ])('blocks registration for a completed DNI %s', async (_case, nationalityResponse, visibleMessage) => {
    const user = userEvent.setup();
    mockUseNationalityConceptAnswers.mockReturnValue(nationalityResponse);
    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));
    await user.type(screen.getByRole('textbox', { name: /Documento de identidad \(opcional\)/u }), '12345678');

    expect(screen.getByText(visibleMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar paciente' })).toBeDisabled();
    expect(screen.queryByText(/GET \/ws\/rest/u)).not.toBeInTheDocument();
  });

  it('clears hidden identity data when switching to an unidentified patient', async () => {
    const user = userEvent.setup();
    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));
    const identifier = screen.getByRole('textbox', { name: /Documento de identidad \(opcional\)/u });
    await user.type(identifier, '12A345678');
    expect(identifier).toHaveValue('12A345678');

    await user.click(screen.getByRole('tab', { name: 'No' }));
    expect(screen.queryByRole('textbox', { name: /Documento de identidad \(opcional\)/u })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Sí' }));
    expect(screen.getByRole('textbox', { name: /Documento de identidad \(opcional\)/u })).toHaveValue('');
  });

  it('clears estimated age when switching from an unidentified to a known patient', async () => {
    const user = userEvent.setup();
    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));
    await user.click(screen.getByRole('tab', { name: 'No' }));
    await user.type(screen.getByRole('spinbutton', { name: /Edad est\. \(años\)/u }), '35');

    await user.click(screen.getByRole('tab', { name: 'Sí' }));
    expect(screen.queryByRole('spinbutton', { name: /Edad est\. \(años\)/u })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'No' }));
    expect(screen.getByRole('spinbutton', { name: /Edad est\. \(años\)/u })).toHaveValue(null);
  });

  it('does not expose identity document configuration details to the operator', async () => {
    const user = userEvent.setup();
    const config = getDefaultsFromConfigSchema(configSchema) as Config;
    config.patientRegistration.foreignCardIdentifierTypeUuid = config.patientRegistration.defaultIdentifierTypeUuid;
    mockUseConfig.mockReturnValue(config);

    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));

    expect(
      screen.getByText(
        'No es posible registrar el documento de identidad debido a una configuración inválida. Contacte al administrador.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mismo UUID/u)).not.toBeInTheDocument();
  });

  it('does not expose backend details when patient search fails', () => {
    mockUsePatientSearch.mockReturnValue({
      data: null,
      isLoading: false,
      fetchError: new Error('GET /ws/rest/v1/patient returned SQLSTATE 42P01'),
      hasMore: false,
      isValidating: false,
      setPage: vi.fn(),
      currentPage: 0,
      totalResults: 0,
    });

    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);

    expect(screen.getByText('No se pudo completar la búsqueda. Intente nuevamente.')).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE|\/ws\/rest/u)).not.toBeInTheDocument();
  });

  it('does not expose backend details when emergency registration fails', async () => {
    const user = userEvent.setup();
    mockSaveEmergencyPatient.mockRejectedValue(
      new Error('POST /ws/rest/v1/patient returned SQLSTATE 23505 duplicate key'),
    );

    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));
    await user.type(screen.getByRole('textbox', { name: /Apellido Paterno/u }), 'Quispe');
    await user.type(screen.getByRole('textbox', { name: /Primer Nombre/u }), 'María');
    await user.selectOptions(screen.getByRole('combobox', { name: /Sexo/u }), 'F');
    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }));

    await waitFor(() => expect(mockSaveEmergencyPatient).toHaveBeenCalledOnce());
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'No se pudo completar el registro. Intente nuevamente o contacte al administrador del sistema.',
      }),
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/SQLSTATE|\/ws\/rest/u) }),
    );
  });

  it('blocks a blind duplicate when the previous registration result is ambiguous', async () => {
    const user = userEvent.setup();
    mockSaveEmergencyPatient.mockRejectedValue(new EmergencyPatientRegistrationAmbiguousError());

    render(<PatientSearchRegistration onPatientQueued={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Registrar nuevo paciente' }));
    await user.type(screen.getByRole('textbox', { name: /Apellido Paterno/u }), 'Quispe');
    await user.type(screen.getByRole('textbox', { name: /Primer Nombre/u }), 'María');
    await user.selectOptions(screen.getByRole('combobox', { name: /Sexo/u }), 'F');
    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }));

    await waitFor(() => expect(mockSaveEmergencyPatient).toHaveBeenCalledOnce());
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'No se pudo confirmar si el paciente ya fue registrado. No genere otro registro ni otro HCE; revise el paciente por HCE antes de continuar.',
      title: 'Error al registrar paciente',
    });
  });
});
