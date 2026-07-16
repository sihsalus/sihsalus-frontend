import { useConfig, useSession, useVisit } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { ConfigObject } from '../config-schema';
import {
  createInterconsulta,
  useAvailableProviders,
  useDestinationServices,
  useInvalidateInterconsultas,
} from '../interconsultas.resource';
import { expectKnownGap } from '../test-utils/expect-known-gap';
import RequestInterconsultaWorkspace from './request-interconsulta.workspace';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUseVisit = vi.mocked(useVisit);
const mockCreateInterconsulta = vi.mocked(createInterconsulta);
const mockUseAvailableProviders = vi.mocked(useAvailableProviders);
const mockUseDestinationServices = vi.mocked(useDestinationServices);
const mockInvalidate = vi.fn();

vi.mock('../interconsultas.resource', async () => ({
  ...(await vi.importActual('../interconsultas.resource')),
  createInterconsulta: vi.fn(),
  useAvailableProviders: vi.fn(),
  useDestinationServices: vi.fn(),
  useInvalidateInterconsultas: vi.fn(),
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
      titleText,
    }: {
      id: string;
      items: Array<{ uuid: string; display?: string }>;
      itemToString: (item: { uuid: string; display?: string } | null) => string;
      onChange: ({ selectedItem }: { selectedItem: { uuid: string; display?: string } | null }) => void;
      titleText: string;
    }) => (
      <label htmlFor={id}>
        {titleText}
        <select
          id={id}
          aria-label={titleText}
          defaultValue=""
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
    RadioButtonGroup: ({ children, legendText }: { children: React.ReactNode; legendText: string }) => (
      <fieldset>
        <legend>{legendText}</legend>
        {children}
      </fieldset>
    ),
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TextArea: ({
      id,
      labelText,
      helperText: _helperText,
      ...props
    }: React.ComponentProps<'textarea'> & { labelText: string; helperText?: string }) => (
      <label htmlFor={id}>
        {labelText}
        <textarea id={id} {...props} />
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
    sessionLocation: { uuid: 'session-location-uuid', display: 'Consulta externa', links: [] },
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
    mockUseConfig.mockReturnValue(config);
    configureSessionWithProvider();
    configureActiveVisit();
    mockUseDestinationServices.mockReturnValue({
      services: [{ uuid: 'dental-service-uuid', display: 'Odontologia General' }],
      isLoading: false,
      error: undefined,
    });
    mockUseAvailableProviders.mockReturnValue({ providers: [], isLoading: false, error: undefined });
    vi.mocked(useInvalidateInterconsultas).mockReturnValue(mockInvalidate);
    mockCreateInterconsulta.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof createInterconsulta>>);
  });

  it('[AC-01] submits patient, active visit, visit location and authenticated provider', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn().mockResolvedValue(true);

    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={closeWorkspace} />);

    await user.selectOptions(screen.getByLabelText('Servicio destino'), 'dental-service-uuid');
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
    expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  });

  it('[AC-01] does not offer a provider selector when the session has a current provider', () => {
    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    expect(screen.queryByLabelText('Solicitante')).not.toBeInTheDocument();
  });

  it('keeps submit disabled until destination and clinical reason are provided', async () => {
    const user = userEvent.setup();
    render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Solicitar interconsulta' });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Servicio destino'), 'dental-service-uuid');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Motivo'), 'Evaluacion odontologica');
    expect(submit).toBeEnabled();
  });

  it('[AC-01][brecha] blocks attribution when the authenticated user has no current provider', async () => {
    await expectKnownGap(() => {
      mockUseSession.mockReturnValue({
        authenticated: true,
        sessionId: 'session-id',
        currentProvider: null,
        sessionLocation: { uuid: 'session-location-uuid', display: 'Consulta externa', links: [] },
      } as ReturnType<typeof useSession>);
      mockUseAvailableProviders.mockReturnValue({
        providers: [{ uuid: 'different-provider-uuid', display: 'Otro Profesional' }],
        isLoading: false,
        error: undefined,
      });

      render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

      expect(screen.queryByLabelText('Solicitante')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Solicitar interconsulta' })).toBeDisabled();
    });
  });

  it('[AC-01][brecha] requires an active visit instead of creating a detached request', async () => {
    await expectKnownGap(async () => {
      mockUseVisit.mockReturnValue({ currentVisit: null } as ReturnType<typeof useVisit>);
      const user = userEvent.setup();

      render(<RequestInterconsultaWorkspace patientUuid="patient-uuid" closeWorkspace={vi.fn()} />);

      await user.selectOptions(screen.getByLabelText('Servicio destino'), 'dental-service-uuid');
      await user.type(screen.getByLabelText('Motivo'), 'Evaluacion odontologica');

      expect(screen.getByRole('button', { name: 'Solicitar interconsulta' })).toBeDisabled();
    });
  });
});
