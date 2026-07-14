import {
  type FetchResponse,
  getUserFacingErrorMessage,
  showSnackbar,
  updateVisit,
  useConfig,
  useVisit,
  type Visit,
  type VisitReturnType,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMutateAppointments } from '../../form/appointments-form.resource';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { AppointmentStatus } from '../../types';

import {
  type ActiveQueueEntrySummary,
  endActiveQueueEntries,
  getActiveQueueEntriesForVisit,
  getActiveVisitsForPatient,
} from './batch-change-appointment-statuses.resources';
import EndAppointmentModal from './end-appointment.modal';

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING: 'APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING',
  changeAppointmentStatus: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn(),
}));

vi.mock('./batch-change-appointment-statuses.resources', () => ({
  endActiveQueueEntries: vi.fn(),
  getActiveQueueEntriesForVisit: vi.fn(),
  getActiveVisitsForPatient: vi.fn(),
}));

const appointmentUuid = 'appointment-uuid';
const appointmentVisitAttributeTypeUuid = 'appointment-visit-attribute-type-uuid';
const patientUuid = 'patient-uuid';
const closeModal = vi.fn();
const mutateAppointments = vi.fn();
const mutateVisits = vi.fn();
const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockEndActiveQueueEntries = vi.mocked(endActiveQueueEntries);
const mockGetActiveQueueEntriesForVisit = vi.mocked(getActiveQueueEntriesForVisit);
const mockGetActiveVisitsForPatient = vi.mocked(getActiveVisitsForPatient);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockUpdateVisit = vi.mocked(updateVisit);
const mockUseConfig = vi.mocked(useConfig);
const mockUseMutateAppointments = vi.mocked(useMutateAppointments);
const mockUseVisit = vi.mocked(useVisit);

const activeVisit = {
  uuid: 'active-visit-uuid',
  patient: { uuid: patientUuid },
  startDatetime: '2026-07-14T14:00:00.000Z',
  stopDatetime: null,
  visitType: { uuid: 'visit-type-uuid', display: 'Consulta externa' },
  location: { uuid: 'location-uuid', display: 'Hospital' },
  attributes: [
    {
      uuid: 'appointment-link-attribute-uuid',
      attributeType: { uuid: appointmentVisitAttributeTypeUuid },
      value: appointmentUuid,
    },
  ],
} as Visit;

function visitResponse(visits: Array<Visit>) {
  return {
    data: { results: visits },
    headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
  } as unknown as FetchResponse<{ results: Array<Visit> }>;
}

function queueResponse(entries: Array<ActiveQueueEntrySummary>) {
  return {
    data: { results: entries },
  } as unknown as FetchResponse<{ results: Array<ActiveQueueEntrySummary> }>;
}

function renderModal() {
  return render(
    <EndAppointmentModal appointmentUuid={appointmentUuid} patientUuid={patientUuid} closeModal={closeModal} />,
  );
}

describe('EndAppointmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserFacingErrorMessage.mockImplementation((error, fallback, options) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      return code != null ? (options.codeMessages?.[code as string] ?? fallback) : fallback;
    });
    mockUseVisit.mockReturnValue({
      activeVisit: null,
      mutate: mutateVisits,
    } as unknown as VisitReturnType);
    mockUseConfig.mockReturnValue({ appointmentVisitAttributeTypeUuid });
    mockUseMutateAppointments.mockReturnValue({ mutateAppointments } as unknown as ReturnType<
      typeof useMutateAppointments
    >);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([]));
    mockGetActiveQueueEntriesForVisit.mockResolvedValue(queueResponse([]));
    mockEndActiveQueueEntries.mockImplementation(async (entries) => entries);
    mockUpdateVisit.mockResolvedValue({} as FetchResponse<Visit>);
    mockChangeAppointmentStatus.mockResolvedValue({} as Awaited<ReturnType<typeof changeAppointmentStatus>>);
  });

  it('closes only the modal when the operator cancels', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('re-reads state and completes the appointment when no active visit exists', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetAppointmentStatus).toHaveBeenCalledTimes(2);
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledWith(
      patientUuid,
      undefined,
      'custom:(uuid,startDatetime,stopDatetime,encounters:(encounterDatetime),attributes:(uuid,value,attributeType:(uuid)))',
      '100',
    );
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
    expect(mutateAppointments).toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith({
      title: 'Atención finalizada',
      subtitle: 'La cita fue marcada como completada.',
      isLowContrast: true,
      kind: 'success',
    });
  });

  it('closes the fresh active visit before completing the appointment', async () => {
    mockUseVisit.mockReturnValue({ activeVisit, mutate: mutateVisits } as unknown as VisitReturnType);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([activeVisit]));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      activeVisit.uuid,
      { stopDatetime: new Date('2026-07-14T15:30:00.999Z') },
      expect.any(AbortController),
    );
    expect(mockGetActiveQueueEntriesForVisit).toHaveBeenCalledWith(activeVisit.uuid);
    expect(mockEndActiveQueueEntries).not.toHaveBeenCalled();
    expect(mockUpdateVisit.mock.invocationCallOrder[0]).toBeLessThan(
      mockChangeAppointmentStatus.mock.invocationCallOrder[0],
    );
    expect(mutateVisits).toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
  });

  it('keeps the modal open and does not complete the appointment when closing the visit fails', async () => {
    mockUseVisit.mockReturnValue({ activeVisit, mutate: mutateVisits } as unknown as VisitReturnType);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([activeVisit]));
    mockUpdateVisit.mockRejectedValueOnce(new Error('SQL connection refused at db.internal'));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo finalizar la atención. La cita no fue completada.',
    );
    expect(screen.queryByText(/SQL connection refused/i)).not.toBeInTheDocument();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeEnabled();
  });

  it('reconciles residual queues when a lost response already closed the linked visit', async () => {
    const unrelatedActiveVisit = {
      ...activeVisit,
      uuid: 'unrelated-active-visit',
      attributes: [
        {
          uuid: 'unrelated-link',
          attributeType: { uuid: appointmentVisitAttributeTypeUuid },
          value: 'other-appointment-uuid',
        },
      ],
    } as Visit;
    const activeQueueEntry = { uuid: 'queue-entry', startedAt: '2026-07-14T15:00:00.000Z' };
    mockUseVisit.mockReturnValue({ activeVisit, mutate: mutateVisits } as unknown as VisitReturnType);
    mockGetActiveVisitsForPatient
      .mockResolvedValueOnce(visitResponse([activeVisit]))
      .mockResolvedValueOnce(visitResponse([unrelatedActiveVisit]));
    mockGetActiveQueueEntriesForVisit.mockResolvedValue(queueResponse([activeQueueEntry]));
    mockEndActiveQueueEntries.mockResolvedValue([{ ...activeQueueEntry, endedAt: '2026-07-14T15:30:00.000Z' }]);
    mockUpdateVisit.mockRejectedValueOnce(new Error('connection closed before response'));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockEndActiveQueueEntries).toHaveBeenCalledWith(
      [expect.objectContaining({ uuid: activeQueueEntry.uuid })],
      expect.any(AbortController),
    );
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
  });

  it('retries only the appointment step after the visit was already closed', async () => {
    mockUseVisit.mockReturnValue({ activeVisit, mutate: mutateVisits } as unknown as VisitReturnType);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([activeVisit]));
    mockChangeAppointmentStatus
      .mockRejectedValueOnce(new Error('upstream status-change failure'))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La consulta ya fue cerrada');
    expect(closeModal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(2);
    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledTimes(2);
  });

  it('does not repeat the appointment transition if a failed response already completed it on the server', async () => {
    mockUseVisit.mockReturnValue({ activeVisit, mutate: mutateVisits } as unknown as VisitReturnType);
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([activeVisit]));
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.CHECKEDIN)
      .mockResolvedValueOnce(AppointmentStatus.CHECKEDIN)
      .mockResolvedValue(AppointmentStatus.COMPLETED);
    mockChangeAppointmentStatus.mockRejectedValueOnce(new Error('connection closed before the response arrived'));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La consulta ya fue cerrada');

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledTimes(1);
  });

  it('re-checks visits on retry when no visit had been closed in the failed attempt', async () => {
    mockGetActiveVisitsForPatient
      .mockResolvedValueOnce(visitResponse([]))
      .mockResolvedValueOnce(visitResponse([activeVisit]));
    mockChangeAppointmentStatus
      .mockRejectedValueOnce(new Error('appointment endpoint unavailable'))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(2);
    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledTimes(2);
  });

  it('treats an already completed appointment as idempotent', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.COMPLETED);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(1);
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('does not mutate data if the appointment no longer permits checkout', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CANCELLED);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El estado de la cita cambió');
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('does not close an active visit that is not linked to the appointment', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitResponse([
        {
          ...activeVisit,
          attributes: [
            {
              uuid: 'other-link',
              attributeType: { uuid: appointmentVisitAttributeTypeUuid },
              value: 'other-appointment-uuid',
            },
          ],
        } as Visit,
      ]),
    );
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no está vinculada a esta cita');
    expect(mockGetActiveQueueEntriesForVisit).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('completes the appointment but keeps a shared visit open while another linked appointment is active', async () => {
    const otherAppointmentUuid = 'other-appointment-uuid';
    const sharedVisit = {
      ...activeVisit,
      attributes: [
        ...(activeVisit.attributes ?? []),
        {
          uuid: 'other-link',
          attributeType: { uuid: appointmentVisitAttributeTypeUuid },
          value: otherAppointmentUuid,
        },
      ],
    } as Visit;
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([sharedVisit]));
    mockGetAppointmentStatus.mockImplementation(async (uuid) =>
      uuid === otherAppointmentUuid ? AppointmentStatus.CHECKEDIN : AppointmentStatus.CHECKEDIN,
    );
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetActiveQueueEntriesForVisit).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle:
          'La cita fue completada. La consulta y la cola permanecen activas porque tienen otra cita vinculada en curso.',
      }),
    );
  });

  it('closes a shared visit after every other linked appointment is terminal', async () => {
    const otherAppointmentUuid = 'other-appointment-uuid';
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitResponse([
        {
          ...activeVisit,
          attributes: [
            ...(activeVisit.attributes ?? []),
            {
              uuid: 'other-link',
              attributeType: { uuid: appointmentVisitAttributeTypeUuid },
              value: otherAppointmentUuid,
            },
          ],
        } as Visit,
      ]),
    );
    mockGetAppointmentStatus.mockImplementation(async (uuid) =>
      uuid === otherAppointmentUuid ? AppointmentStatus.COMPLETED : AppointmentStatus.CHECKEDIN,
    );
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
  });

  it('reconciles a concurrent shared checkout after both appointments become terminal', async () => {
    const otherAppointmentUuid = 'other-appointment-uuid';
    const sharedVisit = {
      ...activeVisit,
      attributes: [
        ...(activeVisit.attributes ?? []),
        {
          uuid: 'other-link',
          attributeType: { uuid: appointmentVisitAttributeTypeUuid },
          value: otherAppointmentUuid,
        },
      ],
    } as Visit;
    let currentAppointmentReads = 0;
    let otherAppointmentReads = 0;
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([sharedVisit]));
    mockGetActiveQueueEntriesForVisit.mockResolvedValue(
      queueResponse([{ uuid: 'shared-queue-entry', startedAt: '2026-07-14T15:00:00.000Z' }]),
    );
    mockEndActiveQueueEntries.mockResolvedValue([
      {
        uuid: 'shared-queue-entry',
        startedAt: '2026-07-14T15:00:00.000Z',
        endedAt: '2026-07-14T15:30:00.500Z',
      },
    ]);
    mockGetAppointmentStatus.mockImplementation(async (uuid) => {
      if (uuid === otherAppointmentUuid) {
        otherAppointmentReads += 1;
        return otherAppointmentReads === 1 ? AppointmentStatus.CHECKEDIN : AppointmentStatus.COMPLETED;
      }

      currentAppointmentReads += 1;
      return currentAppointmentReads <= 2 ? AppointmentStatus.CHECKEDIN : AppointmentStatus.COMPLETED;
    });
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.COMPLETED, appointmentUuid);
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(2);
    expect(mockEndActiveQueueEntries).not.toHaveBeenCalled();
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      sharedVisit.uuid,
      { stopDatetime: new Date('2026-07-14T15:30:00.999Z') },
      expect.any(AbortController),
    );
    expect(mockChangeAppointmentStatus.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateVisit.mock.invocationCallOrder[0],
    );
  });

  it('does not end a queue entry before its millisecond-precision start time', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(visitResponse([activeVisit]));
    mockGetActiveQueueEntriesForVisit.mockResolvedValue(
      queueResponse([{ uuid: 'queue-entry', startedAt: '2026-07-14T15:30:00.750Z' }]),
    );
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      activeVisit.uuid,
      { stopDatetime: new Date('2026-07-14T15:30:00.999Z') },
      expect.any(AbortController),
    );
  });

  it('does not close data when more than one active visit is linked to the appointment', async () => {
    mockGetActiveVisitsForPatient.mockResolvedValue(
      visitResponse([activeVisit, { ...activeVisit, uuid: 'second-active-visit' }]),
    );
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /check out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('más de una consulta activa');
    expect(mockUpdateVisit).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
