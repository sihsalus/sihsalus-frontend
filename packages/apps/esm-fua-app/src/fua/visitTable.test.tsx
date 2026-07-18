import { getDefaultsFromConfigSchema, showModal, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { configSchema, type Config } from '../config-schema';
import { sisAccreditationNoVigenteConceptUuid, sisAccreditationVigenteConceptUuid } from '../constant';
import {
  FuaGenerationError,
  generateFuaFromVisit,
  generateFuasFromVisits,
  useVisits,
  type VisitSummary,
} from '../hooks/useVisit';

import VisitTable from './visitTable';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showModal: vi.fn(),
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

const mockGenerateFuaFromVisit = vi.mocked(generateFuaFromVisit);
const mockGenerateFuasFromVisits = vi.mocked(generateFuasFromVisits);
const mockUseVisits = vi.mocked(useVisits);
const mockShowModal = vi.mocked(showModal);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig);
const mockMutate = vi.fn();

const privateInsuranceConceptUuid = '11111111-2222-3333-4444-555555555555';

interface BuildVisitOptions {
  uuid: string;
  patientName: string;
  financiadorUuid?: string;
  financiadorDisplay?: string;
  accreditationStatusUuid?: string;
}

function buildVisit({
  uuid,
  patientName,
  financiadorUuid,
  financiadorDisplay,
  accreditationStatusUuid,
}: BuildVisitOptions): VisitSummary {
  const attributes: VisitSummary['attributes'] = [];

  if (financiadorUuid) {
    attributes.push({
      uuid: `${uuid}-financiador`,
      attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
      value: { uuid: financiadorUuid, display: financiadorDisplay },
    });
  }

  if (accreditationStatusUuid) {
    attributes.push({
      uuid: `${uuid}-acreditacion`,
      attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
      value: { uuid: accreditationStatusUuid },
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
});

const sisNoVigenteVisit = buildVisit({
  uuid: 'visit-sis-no-vigente',
  patientName: 'Paciente SIS no vigente',
  financiadorUuid: SIS_CONCEPT_UUID,
  financiadorDisplay: 'SIS',
  accreditationStatusUuid: sisAccreditationNoVigenteConceptUuid,
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
    mockShowModal.mockReturnValue(vi.fn());
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

  it('hides non-SIS visits by default and disables generation for them when showing all', () => {
    mockVisits([sisVigenteVisit, privateVisit]);

    render(<VisitTable />);

    expect(screen.getByText('Paciente SIS vigente')).toBeInTheDocument();
    expect(screen.queryByText('Paciente privado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar visitas de todos los financiadores' }));

    const privateRow = screen.getByText('Paciente privado').closest('tr');
    expect(privateRow).not.toBeNull();
    expect(within(privateRow as HTMLElement).getByRole('button', { name: 'Generar FUA' })).toBeDisabled();

    const sisRow = screen.getByText('Paciente SIS vigente').closest('tr');
    expect(within(sisRow as HTMLElement).getByRole('button', { name: 'Generar FUA' })).toBeEnabled();
    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
  });

  it('asks for confirmation before generating a FUA when the SIS accreditation is not active', async () => {
    mockVisits([sisNoVigenteVisit]);
    mockGenerateFuaFromVisit.mockResolvedValue(new Response(null, { status: 200 }));

    render(<VisitTable />);

    fireEvent.click(screen.getByRole('button', { name: 'Generar FUA' }));

    expect(mockGenerateFuaFromVisit).not.toHaveBeenCalled();
    expect(mockShowModal).toHaveBeenCalledWith(
      'fua-accreditation-warning-modal',
      expect.objectContaining({
        accreditationStatusLabel: 'no vigente',
        patientName: 'Paciente SIS no vigente',
      }),
    );

    const modalProps = mockShowModal.mock.calls[0][1] as { onConfirm: () => void };
    modalProps.onConfirm();

    await waitFor(() => expect(mockGenerateFuaFromVisit).toHaveBeenCalledWith('visit-sis-no-vigente'));
  });

  it('excludes visits without an active SIS accreditation from bulk generation', async () => {
    mockVisits([sisVigenteVisit, sisNoVigenteVisit]);
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
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Visitas excluidas del lote',
      }),
    );
  });
});
