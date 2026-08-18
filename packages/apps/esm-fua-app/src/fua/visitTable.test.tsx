import { getDefaultsFromConfigSchema, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { type Config, configSchema } from '../config-schema';
import { sisAccreditationNoVigenteConceptUuid, sisAccreditationVigenteConceptUuid } from '../constant';
import {
  FuaGenerationError,
  generateFuaFromVisit,
  generateFuasFromVisits,
  useVisits,
  type VisitSummary,
} from '../hooks/useVisit';
import useFuaRequests from '../hooks/useFuaRequests';

import VisitTable from './visitTable';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', async () => {
  const React = await import('react');

  return {
    RequirePrivilege: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('../hooks/useVisit', async () => ({
  ...(await vi.importActual('../hooks/useVisit')),
  generateFuaFromVisit: vi.fn(),
  generateFuasFromVisits: vi.fn(),
  useVisits: vi.fn(),
}));

vi.mock('../hooks/useFuaRequests');

const mockGenerateFuaFromVisit = vi.mocked(generateFuaFromVisit);
const mockGenerateFuasFromVisits = vi.mocked(generateFuasFromVisits);
const mockUseVisits = vi.mocked(useVisits);
const mockUseFuaRequests = vi.mocked(useFuaRequests);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig);
const mockMutate = vi.fn();

const privateInsuranceConceptUuid = '11111111-2222-3333-4444-555555555555';

interface BuildVisitOptions {
  uuid: string;
  patientName: string;
  financiadorUuid?: string;
  financiadorDisplay?: string;
  insuranceNumber?: string | null;
  accreditationStatusUuid?: string;
  accreditationCheckedAt?: string;
}

function buildVisit({
  uuid,
  patientName,
  financiadorUuid,
  financiadorDisplay,
  insuranceNumber = 'SIS-AFILIACION-001',
  accreditationStatusUuid,
  accreditationCheckedAt,
}: BuildVisitOptions): VisitSummary {
  const attributes: VisitSummary['attributes'] = [];

  if (financiadorUuid) {
    attributes.push({
      uuid: `${uuid}-financiador`,
      attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
      value: { uuid: financiadorUuid, display: financiadorDisplay },
    });
  }

  if (insuranceNumber) {
    attributes.push({
      uuid: `${uuid}-numero-afiliacion`,
      attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
      value: insuranceNumber,
    });
  }

  if (accreditationStatusUuid) {
    attributes.push({
      uuid: `${uuid}-acreditacion`,
      attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
      value: { uuid: accreditationStatusUuid },
    });
  }

  if (accreditationCheckedAt) {
    attributes.push({
      uuid: `${uuid}-acreditacion-fecha`,
      attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
      value: accreditationCheckedAt,
    });
  }

  return {
    uuid,
    patient: { person: { names: [{ display: patientName }] } },
    location: { display: 'Consulta externa' },
    startDatetime: '2026-07-10T10:00:00.000Z',
    attributes,
  };
}

function mockVisits(visits: Array<VisitSummary>) {
  mockUseVisits.mockReturnValue({
    visits,
    hasLoadedVisits: true,
    isLoading: false,
    isError: null,
    isValidating: false,
    mutate: mockMutate,
  });
}

const sisVigenteVisit = buildVisit({
  uuid: 'visit-sis-vigente',
  patientName: 'Paciente SIS vigente',
  financiadorUuid: SIS_CONCEPT_UUID,
  financiadorDisplay: 'SIS',
  accreditationStatusUuid: sisAccreditationVigenteConceptUuid,
  accreditationCheckedAt: '2026-08-11T14:30:00.000-05:00',
});

const sisNoVigenteVisit = buildVisit({
  uuid: 'visit-sis-no-vigente',
  patientName: 'Paciente SIS no vigente',
  financiadorUuid: SIS_CONCEPT_UUID,
  financiadorDisplay: 'SIS',
  accreditationStatusUuid: sisAccreditationNoVigenteConceptUuid,
  accreditationCheckedAt: '2026-08-11T14:31:00.000-05:00',
});

const privateVisit = buildVisit({
  uuid: 'visit-privado',
  patientName: 'Paciente privado',
  financiadorUuid: privateInsuranceConceptUuid,
  financiadorDisplay: 'Privado',
});

describe('VisitTable FUA generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    mockUseFuaRequests.mockReturnValue({
      fuaOrders: [],
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    mockVisits([sisVigenteVisit]);
    mockGenerateFuasFromVisits.mockResolvedValue({ successful: 0, failed: 0 });
  });

  it('keeps the user on the table and restores the button after a 401 generation failure', async () => {
    let rejectGeneration: (error: FuaGenerationError) => void;
    mockGenerateFuaFromVisit.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectGeneration = reject;
      }),
    );

    render(<VisitTable />);

    const generateButton = screen.getByRole('button', { name: 'Generar FUA' });
    fireEvent.click(generateButton);
    expect(generateButton).toBeDisabled();

    if (!rejectGeneration) {
      throw new Error('The generation request was not started');
    }
    rejectGeneration(new FuaGenerationError(401, { error: 'Contract mismatch' }));

    await waitFor(() => expect(generateButton).toBeEnabled());
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Ocurrió un error al generar el FUA',
      subtitle:
        'El servidor rechazó la generación del FUA. Su sesión permanece activa; inténtelo nuevamente o contacte al administrador.',
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows ErrorState when visits fail before any response is available', async () => {
    mockUseVisits.mockReturnValue({
      visits: [],
      hasLoadedVisits: false,
      isLoading: false,
      isError: new Error('visit request failed'),
      isValidating: false,
      mutate: mockMutate,
    });

    render(<VisitTable />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error State')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron visitas con SIS vigente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  });

  it('keeps cached visits visible and shows an inline recoverable warning when refresh fails', async () => {
    mockUseVisits.mockReturnValue({
      visits: [sisVigenteVisit],
      hasLoadedVisits: true,
      isLoading: false,
      isError: new Error('visit refresh failed'),
      isValidating: false,
      mutate: mockMutate,
    });

    render(<VisitTable />);

    expect(screen.getByText('Paciente SIS vigente')).toBeInTheDocument();
    expect(screen.queryByText('Error State')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron actualizar las visitas');
    expect(screen.getByRole('alert')).toHaveTextContent('Se muestran los últimos datos disponibles');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  });

  it('announces retry progress, disables the action, and coalesces repeated clicks', async () => {
    let resolveRefresh!: () => void;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    mockMutate.mockReturnValueOnce(refreshPromise);
    mockUseVisits.mockReturnValue({
      visits: [],
      hasLoadedVisits: false,
      isLoading: false,
      isError: new Error('visit request failed'),
      isValidating: false,
      mutate: mockMutate,
    });

    render(<VisitTable />);

    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    fireEvent.click(retryButton);

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Actualizando...' })).toBeDisabled();
    expect(screen.getByRole('alert').parentElement).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizando...' }));
    expect(mockMutate).toHaveBeenCalledTimes(1);

    await act(async () => resolveRefresh());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled());
    expect(screen.getByRole('alert').parentElement).toHaveAttribute('aria-busy', 'false');
  });

  it('only lists visits with SIS and an active, complete accreditation', () => {
    mockVisits([sisVigenteVisit, sisNoVigenteVisit, privateVisit]);

    render(<VisitTable />);

    expect(screen.getByText('Paciente SIS vigente')).toBeInTheDocument();
    expect(screen.queryByText('Paciente SIS no vigente')).not.toBeInTheDocument();
    expect(screen.queryByText('Paciente privado')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /todos los financiadores/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar FUA' })).toBeEnabled();
    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
  });

  it('does not offer FUA generation when the SIS accreditation is not active', () => {
    mockVisits([sisNoVigenteVisit]);

    render(<VisitTable />);

    expect(screen.queryByText('Paciente SIS no vigente')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar FUA' })).not.toBeInTheDocument();
    expect(screen.getByText('No se encontraron visitas con SIS vigente')).toBeInTheDocument();
    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
  });

  it('does not treat a vigente status without checked-at as a complete accreditation after reload', () => {
    const incompleteVisit = buildVisit({
      uuid: 'visit-sis-vigente-without-date',
      patientName: 'Paciente SIS sin fecha',
      financiadorUuid: SIS_CONCEPT_UUID,
      financiadorDisplay: 'SIS',
      accreditationStatusUuid: sisAccreditationVigenteConceptUuid,
    });
    mockVisits([incompleteVisit]);

    render(<VisitTable />);

    expect(screen.queryByText('Paciente SIS sin fecha')).not.toBeInTheDocument();
    expect(screen.getByText('No se encontraron visitas con SIS vigente')).toBeInTheDocument();
    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
  });

  it('does not offer individual generation when the SIS affiliation number is missing', () => {
    const missingInsuranceNumberVisit = buildVisit({
      uuid: 'visit-sis-vigente-without-number',
      patientName: 'Paciente SIS sin número',
      financiadorUuid: SIS_CONCEPT_UUID,
      financiadorDisplay: 'SIS',
      insuranceNumber: null,
      accreditationStatusUuid: sisAccreditationVigenteConceptUuid,
      accreditationCheckedAt: '2026-08-11T14:30:00.000-05:00',
    });
    mockVisits([missingInsuranceNumberVisit]);

    render(<VisitTable />);

    expect(screen.queryByText('Paciente SIS sin número')).not.toBeInTheDocument();
    expect(screen.getByText('No se encontraron visitas con SIS vigente')).toBeInTheDocument();
    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
  });

  it('excludes visits without an active SIS accreditation from bulk generation', async () => {
    const incompleteVisit = buildVisit({
      uuid: 'visit-sis-vigente-without-date',
      patientName: 'Paciente SIS sin fecha',
      financiadorUuid: SIS_CONCEPT_UUID,
      financiadorDisplay: 'SIS',
      accreditationStatusUuid: sisAccreditationVigenteConceptUuid,
    });
    const missingInsuranceNumberVisit = buildVisit({
      uuid: 'visit-sis-vigente-without-number',
      patientName: 'Paciente SIS sin número',
      financiadorUuid: SIS_CONCEPT_UUID,
      financiadorDisplay: 'SIS',
      insuranceNumber: null,
      accreditationStatusUuid: sisAccreditationVigenteConceptUuid,
      accreditationCheckedAt: '2026-08-11T14:30:00.000-05:00',
    });
    mockVisits([sisVigenteVisit, sisNoVigenteVisit, incompleteVisit, missingInsuranceNumberVisit]);
    mockGenerateFuasFromVisits.mockResolvedValue({ successful: 1, failed: 0 });

    render(<VisitTable />);

    fireEvent.click(screen.getByRole('button', { name: 'Generar FUAs en masa' }));

    const [selectAllCheckbox, ...rowCheckboxes] = screen.getAllByRole('checkbox');
    expect(selectAllCheckbox).toBeInTheDocument();
    for (const checkbox of rowCheckboxes) {
      fireEvent.click(checkbox);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Generar FUAs seleccionados' }));

    await waitFor(() => expect(mockGenerateFuasFromVisits).toHaveBeenCalledWith(['visit-sis-vigente']));
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'Visitas excluidas del lote' }),
    );
  });
});
