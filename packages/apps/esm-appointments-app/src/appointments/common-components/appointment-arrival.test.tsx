import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  navigate,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AppointmentArrivalRule, type ConfigObject, configSchema } from '../../config-schema';
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

const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockEnsureAppointmentVisitLink = vi.mocked(ensureAppointmentVisitLink);
const mockGetActiveVisitsForPatient = vi.mocked(getActiveVisitsForPatient);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockNavigate = vi.mocked(navigate);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

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
  'No existe una regla de llegada configurada para el servicio y la ubicación de esta cita. Contacte al administrador antes de continuar.';

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
    vi.clearAllMocks();
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockEnsureAppointmentVisitLink.mockResolvedValue({ created: false });
    mockChangeAppointmentStatus.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitsResponse([]));
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
    expect(getQueueButton()).toBeEnabled();
    expect(getDirectButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeEnabled();
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
      'Existe más de una regla de llegada para este servicio y ubicación. Corrija la configuración antes de registrar la llegada.',
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
      'La cita no tiene una ubicación válida. Regularice la cita antes de iniciar la atención.',
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
      'La consulta activa pertenece a otra sede o servicio. Finalícela o regularícela antes de registrar la llegada.',
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
      'La consulta activa pertenece a otra sede o servicio. Finalícela o regularícela antes de registrar la llegada.',
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
