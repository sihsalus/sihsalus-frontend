import {
  fetchCurrentPatient,
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  navigate,
  showSnackbar,
  useConfig,
  usePatient,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { fetchVisitInsurance, getSisFinancingState, safeCopyFinanciadorToVisit } from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

import { type AppointmentArrivalRule, type ConfigObject, configSchema } from '../../config-schema';
import {
  appointmentsCompanionPersonRegistrationWorkspace,
  appointmentsCompanionPersonSearchWorkspace,
  clinicalChartPrivilege,
} from '../../constants';
import {
  changeAppointmentStatus,
  ensureAppointmentVisitLink,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../../types';
import AppointmentArrivalModal from './appointment-arrival.modal';
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING: 'APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING',
  changeAppointmentStatus: vi.fn(),
  ensureAppointmentVisitLink: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn().mockReturnValue({ mutateAppointments: vi.fn() }),
}));

vi.mock('./batch-change-appointment-statuses.resources', () => ({
  getActiveVisitsForPatient: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchVisitInsurance: vi.fn(),
  getSisFinancingState: vi.fn(),
  safeCopyFinanciadorToVisit: vi.fn(),
}));

const mockUsePatient = vi.mocked(usePatient);
const mockFetchCurrentPatient = vi.mocked(fetchCurrentPatient);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockEnsureAppointmentVisitLink = vi.mocked(ensureAppointmentVisitLink);
const mockGetActiveVisitsForPatient = vi.mocked(getActiveVisitsForPatient);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockNavigate = vi.mocked(navigate);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockFetchVisitInsurance = vi.mocked(fetchVisitInsurance);
const mockGetSisFinancingState = vi.mocked(getSisFinancingState);
const mockSafeCopyFinanciadorToVisit = vi.mocked(safeCopyFinanciadorToVisit);

const appointmentVisitAttributeTypeUuid = '193508ab-20c6-5291-9f23-0257335eaabd';
const requiredVisitTypeUuid = 'required-visit-type-uuid';

const appointment: Appointment = {
  uuid: '7cd38a6d-377e-491b-8284-b04cf8b8c6d8',
  appointmentNumber: '0000',
  patient: {
    identifier: '100GEJ',
    identifiers: [],
    name: 'John Wilson',
    uuid: '8673ee4f-e2ab-4077-ba55-4980f408773e',
    gender: 'M',
    age: '35',
  },
  service: {
    appointmentServiceId: 1,
    name: 'Outpatient',
    description: null,
    startTime: '',
    endTime: '',
    maxAppointmentsLimit: null,
    durationMins: null,
    location: {
      uuid: '8d6c993e-c2cc-11de-8d13-0010c6dffd0f',
    },
    uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
    initialAppointmentStatus: 'Scheduled',
    creatorName: null,
  },
  provider: {
    uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66',
    person: {
      uuid: '24252571-dd5a-11e6-9d9c-0242ac150002',
      display: 'Dr James Cook',
    },
  },
  location: {
    name: 'HIV Clinic',
    uuid: '2131aff8-2e2a-480a-b7ab-4ac53250262b',
  },
  startDateTime: new Date().toISOString(),
  appointmentKind: AppointmentKind.WALKIN,
  status: AppointmentStatus.SCHEDULED,
  comments: 'Some comments',
  additionalInfo: null,
  providers: [{ uuid: '24252571-dd5a-11e6-9d9c-0242ac150002', display: 'Dr James Cook' }],
  recurring: false,
  voided: false,
  teleconsultationLink: null,
  extensions: {},
  endDateTime: null,
  dateAppointmentScheduled: null,
};

const appointmentArrivalRule: AppointmentArrivalRule = {
  appointmentServiceUuid: appointment.service.uuid,
  appointmentLocationUuid: appointment.location.uuid,
  arrivalPolicy: 'queue-optional',
  queueUuid: 'mapped-queue-uuid',
  queueLocationUuid: 'mapped-queue-location-uuid',
  requiredVisitTypeUuid,
};

const activeVisit = {
  patient: { uuid: appointment.patient.uuid },
  startDatetime: new Date().toISOString(),
  stopDatetime: null,
  uuid: 'test-visit-uuid',
  encounters: [],
  visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
  location: appointment.location,
};

const closeModal = vi.fn();
const mutateVisits = vi.fn();

const arrivalRuleMissingMessage =
  'No existe una regla de llegada configurada para el servicio y la UPSS de esta cita. Contacte al administrador antes de continuar.';

const expectedPatientChartUrl = (getDefaultsFromConfigSchema(configSchema) as ConfigObject).customPatientChartUrl;

function visitsResponse(visits: Array<typeof activeVisit>) {
  return { data: { results: visits } } as Awaited<ReturnType<typeof getActiveVisitsForPatient>>;
}

function renderModal(appointmentOverride: Appointment = appointment) {
  return render(
    <AppointmentArrivalModal
      appointment={appointmentOverride}
      patientUuid={appointmentOverride.patient.uuid}
      closeModal={closeModal}
      mutateVisits={mutateVisits}
    />,
  );
}

function getQueueButton() {
  return screen.getByRole('button', { name: /enviar a cola de espera/i });
}

function getDirectButton() {
  return screen.getByRole('button', { name: /iniciar atención directamente/i });
}

describe('AppointmentArrivalModal', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReturnValue(true);
    mockUseSession.mockReturnValue({
      user: { uuid: 'admission-user' },
    } as ReturnType<typeof useSession>);
    mockUsePatient.mockReturnValue({
      patient: { birthDate: '1990-01-01' },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);
    vi.clearAllMocks();
    mockFetchCurrentPatient.mockResolvedValue({
      id: appointment.patient.uuid,
      deceasedBoolean: false,
    } as fhir.Patient);
    mockLaunchWorkspace2.mockResolvedValue(true);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockEnsureAppointmentVisitLink.mockResolvedValue({ created: false });
    mockChangeAppointmentStatus.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([]));
    mockGetSisFinancingState.mockReturnValue('active');
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({ ok: true, skipped: true, created: 0, updated: 0 });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [appointmentArrivalRule],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
  });

  it('offers both arrival options along with the appointment summary', () => {
    renderModal();

    expect(screen.getByText('John Wilson')).toBeInTheDocument();
    expect(screen.getByText(/Outpatient/)).toBeInTheDocument();
    expect(screen.getByText(/UPSS: HIV Clinic/)).toBeInTheDocument();
    expect(getQueueButton()).toBeEnabled();
    expect(getDirectButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeEnabled();
  });

  it('blocks arrival when the patient is already known to be deceased', () => {
    mockUsePatient.mockReturnValue({
      patient: {
        birthDate: '1990-01-01',
        deceasedDateTime: '2026-08-12T15:41:28.000Z',
      },
      isLoading: false,
      error: null,
      patientUuid: appointment.patient.uuid,
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();

    expect(screen.getByRole('alert')).toHaveTextContent(/no se puede registrar la llegada de un paciente fallecido/i);
    expect(getQueueButton()).toBeDisabled();
    expect(getDirectButton()).toBeDisabled();
  });

  it('fresh-checks death status before starting arrival', async () => {
    const user = userEvent.setup();
    mockFetchCurrentPatient.mockResolvedValueOnce({
      id: appointment.patient.uuid,
      deceasedBoolean: true,
    } as fhir.Patient);

    renderModal();
    await user.click(getQueueButton());

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no se puede registrar la llegada de un paciente fallecido/i),
    );
    expect(mockFetchCurrentPatient).toHaveBeenCalledWith(appointment.patient.uuid, undefined, false);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'queue' as const,
      activeVisits: [],
      expectedWorkspace: 'appointments-start-visit-workspace',
      label: 'new-visit queue',
    },
    {
      action: 'direct' as const,
      activeVisits: [],
      expectedWorkspace: 'appointments-start-visit-workspace',
      label: 'new direct visit',
    },
    {
      action: 'queue' as const,
      activeVisits: [activeVisit],
      expectedWorkspace: 'appointments-add-active-visit-to-queue-workspace',
      label: 'active-visit queue',
    },
  ])('keeps the modal open when the $label workspace is not opened', async ({
    action,
    activeVisits,
    expectedWorkspace,
  }) => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse(activeVisits));
    mockLaunchWorkspace2.mockResolvedValue(false);

    renderModal();
    const actionButton = action === 'queue' ? getQueueButton() : getDirectButton();
    await userEvent.click(actionButton);

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledWith(expectedWorkspace, expect.anything()));
    expect(closeModal).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /registrar llegada/i })).toBeInTheDocument();
    expect(actionButton).toBeEnabled();
  });

  it('fails closed when the service and location have no arrival rule', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    renderModal();

    expect(screen.getByRole('alert')).toHaveTextContent(arrivalRuleMissingMessage);
    expect(closeModal).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /enviar a cola de espera/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar atención directamente/i })).not.toBeInTheDocument();
  });

  it('offers only direct care for a direct arrival rule', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          arrivalPolicy: 'direct',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    renderModal();
    expect(screen.queryByRole('button', { name: /enviar a cola de espera/i })).not.toBeInTheDocument();
    await userEvent.click(getDirectButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith('appointments-start-visit-workspace', expect.anything()),
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('offers only the queue for a queue-required arrival rule', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [{ ...appointmentArrivalRule, arrivalPolicy: 'queue-required' }],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    renderModal();

    expect(getQueueButton()).toBeEnabled();
    expect(screen.queryByRole('button', { name: /iniciar atención directamente/i })).not.toBeInTheDocument();
  });

  it('fails closed with an inline error when multiple arrival rules match', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [
        appointmentArrivalRule,
        {
          ...appointmentArrivalRule,
          queueUuid: 'second-queue-uuid',
          queueLocationUuid: 'second-queue-location-uuid',
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    renderModal();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Existe más de una regla de llegada para este servicio y UPSS. Corrija la configuración antes de registrar la llegada.',
    );
    expect(screen.queryByRole('button', { name: /enviar a cola de espera/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar atención directamente/i })).not.toBeInTheDocument();
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('fails closed when the appointment has no location', () => {
    const legacyAppointment = {
      ...appointment,
      location: undefined,
    } as unknown as Appointment;

    renderModal(legacyAppointment);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La cita no tiene una UPSS válida. Regularice la cita antes de iniciar la atención.',
    );
    expect(screen.queryByRole('button', { name: /enviar a cola de espera/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar atención directamente/i })).not.toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('adds an active visit to the queue and checks the appointment in after the queue entry is added', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));

    renderModal();
    await userEvent.click(getQueueButton());

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-add-active-visit-to-queue-workspace',
      expect.objectContaining({
        selectedPatientUuid: appointment.patient.uuid,
        activeVisit: expect.objectContaining({ uuid: 'test-visit-uuid' }),
        currentQueueLocationUuid: 'mapped-queue-location-uuid',
        currentServiceQueueUuid: 'mapped-queue-uuid',
        requiredVisitLocation: {
          uuid: appointment.location.uuid,
          display: appointment.location.name,
        },
        requiredVisitTypeUuid,
        onBeforeQueueEntrySave: expect.any(Function),
        onQueueEntryAdded: expect.any(Function),
      }),
    );
    expect(closeModal).toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onQueueEntryAdded: () => Promise<void>;
    };
    await act(async () => launchOptions.onQueueEntryAdded());

    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith('CheckedIn', appointment.uuid);
  });

  it('launches the start visit workspace with queue parameters when enqueuing without an active visit', async () => {
    renderModal();
    await userEvent.click(getQueueButton());

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-start-visit-workspace',
      expect.objectContaining({
        patientUuid: appointment.patient.uuid,
        companionPersonRegistrationWorkspaceName: appointmentsCompanionPersonRegistrationWorkspace,
        companionPersonSearchWorkspaceName: appointmentsCompanionPersonSearchWorkspace,
        additionalVisitAttributes: [
          {
            attributeType: appointmentVisitAttributeTypeUuid,
            value: appointment.uuid,
          },
        ],
        visitPersistenceCorrelation: {
          attributeType: appointmentVisitAttributeTypeUuid,
          value: appointment.uuid,
        },
        currentQueueLocationUuid: appointmentArrivalRule.queueLocationUuid,
        currentServiceQueueUuid: appointmentArrivalRule.queueUuid,
        requiredVisitLocation: {
          uuid: appointment.location.uuid,
          display: appointment.location.name,
        },
        requiredVisitTypeUuid,
        openedFrom: 'appointments-check-in',
        workspaceTitle: 'Iniciar atención de la cita',
        workspaceDescription:
          'Revise los datos de la atención. Al confirmar, se registrará la llegada y el paciente será agregado a la cola seleccionada.',
        onVisitStarted: expect.any(Function),
      }),
    );
    expect(closeModal).toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onVisitStarted: () => Promise<void>;
    };
    await act(async () => launchOptions.onVisitStarted());

    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CHECKEDIN, appointment.uuid);
  });

  it('does not check in when the patient is marked deceased while the arrival workspace is open', async () => {
    mockFetchCurrentPatient
      .mockResolvedValueOnce({ id: appointment.patient.uuid, deceasedBoolean: false } as fhir.Patient)
      .mockResolvedValueOnce({ id: appointment.patient.uuid, deceasedBoolean: true } as fhir.Patient);

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onVisitStarted: () => Promise<void>;
    };
    await expect(launchOptions.onVisitStarted()).rejects.toMatchObject({
      code: 'DECEASED_PATIENT_ARRIVAL_BLOCKED',
    });

    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('routes an appointment arrival through the configured triage queue', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [{ ...appointmentArrivalRule, requiresTriage: true }],
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    renderModal();
    await userEvent.click(getQueueButton());

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-start-visit-workspace',
      expect.objectContaining({
        currentQueueLocationUuid: 'triage-location-uuid',
        currentServiceQueueUuid: 'triage-queue-uuid',
        requireActiveSisFinancing: true,
        workspaceTitle: 'Registrar llegada y enviar a triaje',
        workspaceDescription:
          'Revise los datos de la atención. Al confirmar, se registrará la llegada y el paciente pasará primero a la cola de triaje.',
      }),
    );
  });

  it('blocks enqueuing with an active visit from another location', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitsResponse([
        {
          ...activeVisit,
          location: { uuid: 'other-location', name: 'Otra sede' },
        },
      ]),
    );

    renderModal();
    await userEvent.click(getQueueButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La consulta activa pertenece a otra UPSS o servicio. Finalícela o regularícela antes de registrar la llegada.',
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('blocks enqueuing with an incompatible active visit type', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitsResponse([
        {
          ...activeVisit,
          visitType: { uuid: 'other-visit-type', display: 'Otro tipo' },
        },
      ]),
    );

    renderModal();
    await userEvent.click(getQueueButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El tipo de la consulta activa no corresponde al servicio de la cita. Regularice la consulta antes de continuar.',
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
  });

  it('rejects queue persistence when the active visit changes location while the workspace is open', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValueOnce(visitsResponse([activeVisit])).mockResolvedValueOnce(
      visitsResponse([
        {
          ...activeVisit,
          location: { uuid: 'other-location', name: 'Otra' },
        },
      ]),
    );

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(false);
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(2);
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
  });

  it('allows queue retry when the appointment was already checked in after a lost response', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.SCHEDULED)
      .mockResolvedValueOnce(AppointmentStatus.CHECKEDIN);

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(true);
    expect(mockEnsureAppointmentVisitLink).toHaveBeenCalledWith(
      activeVisit.uuid,
      appointment.uuid,
      appointmentVisitAttributeTypeUuid,
    );
  });

  it('blocks queue persistence when the appointment status changes while the workspace is open', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.SCHEDULED)
      .mockResolvedValueOnce(AppointmentStatus.CANCELLED);

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(false);
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('closes silently when the appointment is already checked in', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);

    renderModal();
    await userEvent.click(getQueueButton());

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('starts care directly by creating a visit without a queue entry and checking in', async () => {
    renderModal();
    await userEvent.click(getDirectButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
        'appointments-start-visit-workspace',
        expect.objectContaining({
          patientUuid: appointment.patient.uuid,
          companionPersonRegistrationWorkspaceName: appointmentsCompanionPersonRegistrationWorkspace,
          companionPersonSearchWorkspaceName: appointmentsCompanionPersonSearchWorkspace,
          additionalVisitAttributes: [
            {
              attributeType: appointmentVisitAttributeTypeUuid,
              value: appointment.uuid,
            },
          ],
          visitPersistenceCorrelation: {
            attributeType: appointmentVisitAttributeTypeUuid,
            value: appointment.uuid,
          },
          requiredVisitLocation: {
            uuid: appointment.location.uuid,
            display: appointment.location.name,
          },
          requiredVisitTypeUuid,
          openedFrom: 'appointments-direct-start',
          workspaceTitle: 'Iniciar atención de la cita',
          workspaceDescription:
            'Revise los datos de la atención. Al confirmar, se iniciará la consulta y se registrará la llegada sin enviar al paciente a una cola.',
          onVisitStarted: expect.any(Function),
        }),
      ),
    );

    const [, launchOptions] = mockLaunchWorkspace2.mock.calls[0] as [
      string,
      {
        currentServiceQueueUuid?: string;
        currentQueueLocationUuid?: string;
        onVisitStarted: () => Promise<void>;
      },
    ];
    expect(launchOptions.currentServiceQueueUuid).toBeUndefined();
    expect(launchOptions.currentQueueLocationUuid).toBeUndefined();
    expect(closeModal).toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();

    await act(async () => launchOptions.onVisitStarted());

    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CHECKEDIN, appointment.uuid);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: expectedPatientChartUrl,
      templateParams: { patientUuid: appointment.patient.uuid },
    });
  });

  it('starts care directly by reusing the active visit and navigating to the patient chart', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));

    renderModal();
    await userEvent.click(getDirectButton());

    await waitFor(() => expect(mockChangeAppointmentStatus).toHaveBeenCalledWith('CheckedIn', appointment.uuid));
    expect(mockEnsureAppointmentVisitLink).toHaveBeenCalledWith(
      activeVisit.uuid,
      appointment.uuid,
      appointmentVisitAttributeTypeUuid,
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({
      to: expectedPatientChartUrl,
      templateParams: { patientUuid: appointment.patient.uuid },
    });
  });

  it('keeps direct care visible but disabled with an actionable reason when patient chart access is missing', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== clinicalChartPrivilege);

    renderModal();

    expect(getQueueButton()).toBeEnabled();
    expect(getDirectButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La atención directa requiere acceso a la historia clínica del paciente. Solicite ese acceso o use la cola, si está habilitada.',
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rejects triage queue persistence when the active visit does not have current SIS financing', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [{ ...appointmentArrivalRule, requiresTriage: true }],
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: 'sis-uuid',
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: 'inactive-status-uuid',
      accreditationCheckedAt: '2026-08-11T14:30:00.000-05:00',
    });
    mockGetSisFinancingState.mockReturnValue('inactive');

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(false);
    expect(mockFetchVisitInsurance).toHaveBeenCalledWith(activeVisit.uuid);
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No se pudo registrar la llegada',
        subtitle:
          'No se puede continuar con el triaje porque esta atención no tiene SIS vigente. Derive al paciente a Caja para regularizar el pago o la cobertura.',
      }),
    );
  });

  it('allows an already funded triage visit when the optional person backfill is not authorized', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [{ ...appointmentArrivalRule, requiresTriage: true }],
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'Get People');
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({ ok: false, error: { status: 403 } });
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: 'sis-uuid',
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: 'active-status-uuid',
      accreditationCheckedAt: '2026-08-11T14:30:00.000-05:00',
    });
    mockGetSisFinancingState.mockReturnValue('active');

    renderModal();
    await userEvent.click(getQueueButton());

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(true);
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledWith({
      patientUuid: appointment.patient.uuid,
      visitUuid: activeVisit.uuid,
      onlyFillMissing: true,
    });
    expect(mockFetchVisitInsurance).toHaveBeenCalledWith(activeVisit.uuid);
    expect(mockEnsureAppointmentVisitLink).toHaveBeenCalledWith(
      activeVisit.uuid,
      appointment.uuid,
      appointmentVisitAttributeTypeUuid,
    );
  });

  it('does not leave a direct-only arrival modal with only Cancel when patient chart access is missing', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          arrivalPolicy: 'direct',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    mockUserHasAccess.mockImplementation((privilege) => privilege !== clinicalChartPrivilege);

    renderModal();

    expect(getDirectButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /enviar a cola/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/requiere acceso a la historia clínica/i);
  });

  it('blocks before reading visits when the operator cannot inspect active visits', async () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'Get Visits');

    renderModal();
    await userEvent.click(getDirectButton());

    expect(
      await screen.findByText(/Su usuario no puede verificar las consultas activas del paciente\./),
    ).toBeInTheDocument();
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('uses the StartVisit guard OR contract and does not require queue privileges for direct care', async () => {
    const directPrivileges = new Set([clinicalChartPrivilege, 'Get Visits', 'app:home.admision']);
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && directPrivileges.has(privilege),
    );

    renderModal();
    await waitFor(() => expect(getDirectButton()).toBeEnabled());
    await userEvent.click(getDirectButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith('appointments-start-visit-workspace', expect.anything()),
    );
    expect(mockUserHasAccess).not.toHaveBeenCalledWith('Get Queue Entries', expect.anything());
    expect(mockUserHasAccess).not.toHaveBeenCalledWith('Manage Queue Entries', expect.anything());
  });

  it('blocks a new direct visit when none of the StartVisit creation capabilities is present', async () => {
    const directPrivileges = new Set([clinicalChartPrivilege, 'Get Visits']);
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && directPrivileges.has(privilege),
    );

    renderModal();
    await userEvent.click(getDirectButton());

    expect(await screen.findByText(/Su usuario no puede crear la consulta requerida\./)).toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('blocks active-visit reuse before persistence when visit edit access is missing', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'Edit Visits');

    renderModal();
    await userEvent.click(getDirectButton());

    expect(
      await screen.findByText(/Existe una consulta activa, pero su usuario no puede vincularla con la cita\./),
    ).toBeInTheDocument();
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('blocks queue arrival when a native queue-entry dependency is missing', async () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'Manage Queue Entries');

    renderModal();

    expect(getQueueButton()).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Su usuario no puede registrar entradas en cola.');
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('reuses an active visit for queue arrival without requiring visit-creation authority', async () => {
    const queuePrivileges = new Set([
      'Get Patients',
      'Get Locations',
      'Get Visits',
      'Edit Visits',
      'Get Visit Attribute Types',
      'Get Queue Entries',
      'Get Queues',
      'Manage Queue Entries',
      clinicalChartPrivilege,
    ]);
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && queuePrivileges.has(privilege),
    );
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));

    renderModal();
    await waitFor(() => expect(getQueueButton()).toBeEnabled());
    await userEvent.click(getQueueButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
        'appointments-add-active-visit-to-queue-workspace',
        expect.anything(),
      ),
    );
  });

  it('explains the companion block before opening the visit form for a minor without any companion path', async () => {
    mockUserHasAccess.mockImplementation((privilege) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return !privileges.some((item) =>
        ['Get People', 'app:opciones.registrarAcompanante', 'Add People'].includes(item),
      );
    });
    mockUsePatient.mockReturnValue({
      patient: { birthDate: dayjs().subtract(10, 'year').format('YYYY-MM-DD') },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([]));

    renderModal();
    await userEvent.click(getDirectButton());

    expect(await screen.findByText(/menor de edad y requiere un acompañante/i)).toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('allows a minor arrival when the operator can search for a companion', async () => {
    mockUserHasAccess.mockImplementation((privilege) => {
      if (privilege === 'Get People') {
        return true;
      }
      if (privilege === 'app:opciones.registrarAcompanante' || privilege === 'Add People') {
        return false;
      }
      return true;
    });
    mockUsePatient.mockReturnValue({
      patient: { birthDate: dayjs().subtract(10, 'year').format('YYYY-MM-DD') },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();
    await userEvent.click(getQueueButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith('appointments-start-visit-workspace', expect.anything()),
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('allows a minor arrival when the operator can register a companion but cannot search', async () => {
    mockUserHasAccess.mockImplementation((privilege) => {
      if (privilege === 'Get People') {
        return false;
      }
      if (privilege === 'app:opciones.registrarAcompanante' || privilege === 'Add People') {
        return true;
      }
      return true;
    });
    mockUsePatient.mockReturnValue({
      patient: { birthDate: dayjs().subtract(10, 'year').format('YYYY-MM-DD') },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();
    await userEvent.click(getDirectButton());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith('appointments-start-visit-workspace', expect.anything()),
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('requires both registration privileges when search is unavailable', async () => {
    mockUserHasAccess.mockImplementation((privilege) => {
      if (privilege === 'Get People' || privilege === 'Add People') {
        return false;
      }
      return true;
    });
    mockUsePatient.mockReturnValue({
      patient: { birthDate: dayjs().subtract(10, 'year').format('YYYY-MM-DD') },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();
    await userEvent.click(getDirectButton());

    expect(await screen.findByText(/no tiene permisos para buscar ni registrar personas/i)).toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('does not open the visit form while the patient age is loading', async () => {
    mockUsePatient.mockReturnValue({
      patient: undefined,
      isLoading: true,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    const { rerender } = renderModal();

    expect(screen.getByText(/verificando la edad del paciente/i)).toBeInTheDocument();
    expect(getDirectButton()).toBeDisabled();
    expect(getQueueButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeEnabled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();

    mockUsePatient.mockReturnValue({
      patient: { birthDate: '1990-01-01' },
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);
    rerender(
      <AppointmentArrivalModal
        appointment={appointment}
        patientUuid={appointment.patient.uuid}
        closeModal={closeModal}
        mutateVisits={mutateVisits}
      />,
    );

    expect(screen.queryByText(/verificando la edad del paciente/i)).not.toBeInTheDocument();
    expect(getDirectButton()).toBeEnabled();
  });

  it('does not open the visit form when loading the patient fails', async () => {
    mockUsePatient.mockReturnValue({
      patient: undefined,
      isLoading: false,
      error: new Error('Patient request failed'),
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();
    await userEvent.click(getQueueButton());

    expect(await screen.findByText(/no se pudo verificar la edad del paciente/i)).toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('does not open the visit form when the patient has no valid birth date', async () => {
    mockUsePatient.mockReturnValue({
      patient: {},
      isLoading: false,
      error: null,
      patientUuid: 'patient-uuid',
    } as unknown as ReturnType<typeof usePatient>);

    renderModal();
    await userEvent.click(getDirectButton());

    expect(await screen.findByText(/no se pudo verificar la edad del paciente/i)).toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('reuses an active visit for a direct-only arrival rule', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentArrivalRules: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          arrivalPolicy: 'direct',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([activeVisit]));

    renderModal();
    await userEvent.click(getDirectButton());

    await waitFor(() => expect(mockChangeAppointmentStatus).toHaveBeenCalledWith('CheckedIn', appointment.uuid));
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('blocks starting care directly with an active visit from another location', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitsResponse([
        {
          ...activeVisit,
          location: { uuid: 'other-location', name: 'Otra sede' },
        },
      ]),
    );

    renderModal();
    await userEvent.click(getDirectButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La consulta activa pertenece a otra UPSS o servicio. Finalícela o regularícela antes de registrar la llegada.',
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
