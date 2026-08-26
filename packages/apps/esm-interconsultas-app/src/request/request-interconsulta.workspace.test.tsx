import { UserHasAccess, useConfig, useSession, useVisit } from '@openmrs/esm-framework';
import { useOrderBasket } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type ReactNode } from 'react';
import type { ConfigObject } from '../config-schema';
import { createInterconsulta, useDestinationServices, useInvalidateInterconsultas } from '../interconsultas.resource';
import RequestInterconsultaWorkspace from './request-interconsulta.workspace';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUseVisit = vi.mocked(useVisit);
const mockCreateInterconsulta = vi.mocked(createInterconsulta);
const mockUseDestinationServices = vi.mocked(useDestinationServices);
const mockUseOrderBasket = vi.mocked(useOrderBasket);
const mockInvalidate = vi.fn();
const mockSetOrders = vi.fn();

vi.mock('../interconsultas.resource', async () => ({
  ...(await vi.importActual('../interconsultas.resource')),
  createInterconsulta: vi.fn(),
  useDestinationServices: vi.fn(),
  useInvalidateInterconsultas: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useOrderBasket: vi.fn(),
}));

vi.mock('@carbon/react', async () => {
  const original = await vi.importActual('@carbon/react');
  return {
    ...original,
    ButtonSet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComboBox: ({
      id,
      items,
      itemToString,
      onChange,
      selectedItem,
      titleText,
    }: {
      id: string;
      items: Array<{ uuid: string; display?: string }>;
      itemToString: (item: { uuid: string; display?: string } | null) => string;
      onChange: ({ selectedItem }: { selectedItem: { uuid: string; display?: string } | null }) => void;
      selectedItem?: { uuid: string; display?: string } | null;
      titleText: string;
    }) => (
      <label htmlFor={id}>
        {titleText}
        <select
          id={id}
          aria-label={titleText}
          value={selectedItem?.uuid ?? ''}
          onChange={(event) => {
            const selectedItem = items.find((item) => item.uuid === event.target.value) ?? null;
            onChange({ selectedItem });
          }}
        >
          <option value="">Seleccione</option>
          {items.map((item) => (
            <option key={item.uuid} value={item.uuid}>
              {itemToString(item)}
            </option>
          ))}
        </select>
      </label>
    ),
    Form: ({ children, ...props }: React.ComponentProps<'form'>) => <form {...props}>{children}</form>,
    InlineNotification: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <div role="alert">
        <strong>{title}</strong>
        {subtitle}
      </div>
    ),
    RadioButton: ({ id, labelText, value }: { id: string; labelText: string; value: string }) => (
      <label htmlFor={id}>
        <input id={id} type="radio" value={value} />
        {labelText}
      </label>
    ),
    RadioButtonGroup: ({
      children,
      legendText,
      onChange,
    }: {
      children: React.ReactNode;
      legendText: string;
      onChange: (value: string) => void;
    }) => (
      <fieldset onChange={(event) => onChange((event.target as HTMLInputElement).value)}>
        <legend>{legendText}</legend>
        {children}
      </fieldset>
    ),
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TextArea: ({
      id,
      labelText,
      helperText: _helperText,
      maxCount,
      ...props
    }: React.ComponentProps<'textarea'> & {
      labelText: string;
      helperText?: string;
      maxCount?: number;
    }) => (
      <label htmlFor={id}>
        {labelText}
        <textarea id={id} maxLength={maxCount} {...props} />
      </label>
    ),
    TextInput: ({
      id,
      labelText,
      helperText: _helperText,
      ...props
    }: React.ComponentProps<'input'> & {
      labelText: string;
      helperText?: string;
    }) => (
      <label htmlFor={id}>
        {labelText}
        <input id={id} {...props} />
      </label>
    ),
  };
});

const config: ConfigObject = {
  interconsultaOrderTypeUuid: 'interconsulta-order-type',
  careSettingUuid: 'outpatient-care-setting',
  requestEncounterTypeUuid: 'interconsulta-encounter-type',
  clinicianEncounterRoleUuid: 'clinician-role',
  orderableConceptSets: ['destination-set'],
  excludedDestinationConceptUuids: [],
  externalSpecialistConceptUuid: 'external-specialist-concept',
  concepts: {
    respuestaConceptUuid: 'response-concept',
    recomendacionesConceptUuid: '',
  },
};

function configureSessionWithProvider() {
  mockUseSession.mockReturnValue({
    authenticated: true,
    sessionId: 'session-id',
    currentProvider: {
      uuid: 'requester-provider-uuid',
      identifier: 'requester-provider',
      display: 'Profesional Solicitante',
    },
    sessionLocation: {
      uuid: 'session-location-uuid',
      display: 'Consulta externa',
      links: [],
    },
  } as ReturnType<typeof useSession>);
}

function configureActiveVisit() {
  mockUseVisit.mockReturnValue({
    currentVisit: {
      uuid: 'visit-uuid',
      location: { uuid: 'visit-location-uuid', display: 'Consultorio 1' },
    },
  } as ReturnType<typeof useVisit>);
}

describe('RequestInterconsultaWorkspace acceptance contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
    mockUseConfig.mockReturnValue(config);
    configureSessionWithProvider();
    configureActiveVisit();
    mockUseDestinationServices.mockReturnValue({
      services: [{ uuid: 'dental-service-uuid', display: 'Odontologia General' }],
      isLoading: false,
      error: undefined,
    });
    mockUseOrderBasket.mockReturnValue({
      orders: [],
      setOrders: mockSetOrders,
      clearOrders: vi.fn(),
    } as unknown as ReturnType<typeof useOrderBasket>);
    vi.mocked(useInvalidateInterconsultas).mockReturnValue(mockInvalidate);
    mockCreateInterconsulta.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof createInterconsulta>>);
  });

  it('[AC-01] submits patient, active visit, visit location and authenticated provider', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn().mockResolvedValue(true);

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={closeWorkspace} />);

    await user.selectOptions(screen.getByLabelText('Consultorio o servicio destino'), 'dental-service-uuid');
    await user.type(screen.getByLabelText('Motivo'), 'Dolor dental persistente');
    await user.click(screen.getByRole('button', { name: 'Solicitar interconsulta' }));

    await waitFor(() => {
      expect(mockCreateInterconsulta).toHaveBeenCalledWith(
        expect.objectContaining({
          patientUuid: 'patient-uuid',
          visitUuid: 'visit-uuid',
          locationUuid: 'visit-location-uuid',
          providerUuid: 'requester-provider-uuid',
          serviceConceptUuid: 'dental-service-uuid',
          urgency: 'ROUTINE',
          motivo: 'Dolor dental persistente',
          config,
        }),
        expect.anything(),
      );
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(closeWorkspace).toHaveBeenCalledWith({
      discardUnsavedChanges: true,
    });
  });

  it('[AC-01] uses activeVisit when currentVisit is not populated by the framework', async () => {
    mockUseVisit.mockReturnValue({
      activeVisit: {
        uuid: 'active-visit-uuid',
        location: {
          uuid: 'active-visit-location-uuid',
          display: 'Consultorio 2',
        },
      },
      currentVisit: null,
    } as ReturnType<typeof useVisit>);
    const user = userEvent.setup();

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Consultorio o servicio destino'), 'dental-service-uuid');
    await user.type(screen.getByLabelText('Motivo'), 'Evaluacion odontologica');
    await user.click(screen.getByRole('button', { name: 'Solicitar interconsulta' }));

    expect(mockCreateInterconsulta).toHaveBeenCalledWith(
      expect.objectContaining({
        visitUuid: 'active-visit-uuid',
        locationUuid: 'active-visit-location-uuid',
      }),
      expect.anything(),
    );
  });

  it('[AC-01] does not offer a provider selector when the session has a current provider', () => {
    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    expect(screen.queryByLabelText('Solicitante')).not.toBeInTheDocument();
  });

  it('keeps submit disabled until destination and clinical reason are provided', async () => {
    const user = userEvent.setup();
    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    const submit = screen.getByRole('button', {
      name: 'Solicitar interconsulta',
    });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Consultorio o servicio destino'), 'dental-service-uuid');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Motivo'), 'Evaluacion odontologica');
    expect(submit).toBeEnabled();
  });

  it('[AC-01] blocks attribution when the authenticated user has no current provider', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      currentProvider: null,
      sessionLocation: {
        uuid: 'session-location-uuid',
        display: 'Consulta externa',
        links: [],
      },
    } as ReturnType<typeof useSession>);

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    expect(screen.getByText('Profesional clínico requerido')).toBeInTheDocument();
    expect(screen.queryByLabelText('Solicitante')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar interconsulta' })).toBeDisabled();
  });

  it('creates an external specialist interconsultation without invoking a referral workflow', async () => {
    const user = userEvent.setup();

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    await user.click(screen.getByLabelText('Especialista externo o remoto'));
    await user.type(screen.getByLabelText('Especialidad o profesional destino'), 'Cardiología remota');
    await user.type(screen.getByLabelText('Motivo'), 'Segunda opinión terapéutica');
    await user.click(screen.getByRole('button', { name: 'Solicitar interconsulta' }));

    expect(mockCreateInterconsulta).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceConceptUuid: 'external-specialist-concept',
        motivo: 'Destino externo/remoto: Cardiología remota\nMotivo: Segunda opinión terapéutica',
      }),
      expect.anything(),
    );
    expect(screen.getByText(/No genera referencia, contrarreferencia ni traslado/)).toBeInTheDocument();
  });

  it('adds a completed interconsultation item to the order basket instead of posting it immediately', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn().mockResolvedValue(true);

    render(
      <RequestInterconsultaWorkspace
        patientUuid="patient-uuid"
        orderTypeUuid="interconsulta-order-type"
        submissionMode="order-basket"
        closeWorkspace={closeWorkspace}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Consultorio o servicio destino'), 'dental-service-uuid');
    await user.type(screen.getByLabelText('Motivo'), 'Dolor dental persistente');
    await user.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(mockSetOrders).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'NEW',
        careSetting: 'outpatient-care-setting',
        concept: {
          uuid: 'dental-service-uuid',
          display: 'Odontologia General',
        },
        display: 'Odontologia General',
        instructions: 'Dolor dental persistente',
        isOrderIncomplete: false,
        orderer: 'requester-provider-uuid',
        orderType: 'interconsulta-order-type',
        urgency: 'ROUTINE',
        urgencyCode: 'ROUTINE',
      }),
    ]);
    expect(mockCreateInterconsulta).not.toHaveBeenCalled();
    expect(closeWorkspace).toHaveBeenCalledWith({
      discardUnsavedChanges: true,
    });
  });

  it('keeps separate external specialist requests in the order basket', async () => {
    const user = userEvent.setup();
    const existingExternalOrder = {
      action: 'NEW',
      concept: {
        uuid: 'external-specialist-concept',
        display: 'Cardiología remota',
      },
      display: 'Cardiología remota',
      instructions: 'Destino externo/remoto: Cardiología remota\nMotivo: Segunda opinión',
      orderer: 'requester-provider-uuid',
      orderType: 'interconsulta-order-type',
      urgency: 'ROUTINE',
    };
    mockUseOrderBasket.mockReturnValue({
      orders: [existingExternalOrder],
      setOrders: mockSetOrders,
      clearOrders: vi.fn(),
    } as unknown as ReturnType<typeof useOrderBasket>);

    render(
      <RequestInterconsultaWorkspace
        patientUuid="patient-uuid"
        orderTypeUuid="interconsulta-order-type"
        submissionMode="order-basket"
        closeWorkspace={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByLabelText('Especialista externo o remoto'));
    await user.type(screen.getByLabelText('Especialidad o profesional destino'), 'Neurología remota');
    await user.type(screen.getByLabelText('Motivo'), 'Evaluación diagnóstica');
    await user.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(mockSetOrders).toHaveBeenCalledWith([
      existingExternalOrder,
      expect.objectContaining({
        concept: {
          uuid: 'external-specialist-concept',
          display: 'Neurología remota',
        },
        instructions: 'Destino externo/remoto: Neurología remota\nMotivo: Evaluación diagnóstica',
      }),
    ]);
  });

  it('[AC-01] requires an active visit instead of creating a detached request', async () => {
    mockUseVisit.mockReturnValue({ currentVisit: null } as ReturnType<typeof useVisit>);
    const user = userEvent.setup();

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Consultorio o servicio destino'), 'dental-service-uuid');
    await user.type(screen.getByLabelText('Motivo'), 'Evaluacion odontologica');

    expect(screen.getByRole('button', { name: 'Solicitar interconsulta' })).toBeDisabled();
    expect(mockCreateInterconsulta).not.toHaveBeenCalled();
  });

  it('blocks direct workspace rendering without interconsultas.editar', () => {
    vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    expect(screen.getByText('Sección no disponible para su usuario')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar interconsulta' })).not.toBeInTheDocument();
  });
});
