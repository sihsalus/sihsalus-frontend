import { type FetchResponse, openmrsFetch, showSnackbar, useLocations, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { closeOverlay } from '../../hooks/useOverlay';

import AppointmentServices from './appointment-services.component';
import {
  APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY,
  loadAppointmentServiceCreationCheckpoint,
} from './appointment-service-creation-checkpoint';

const mockAppointmentServiceState = vi.hoisted(() => ({ initialValue: undefined as unknown }));
const mockAddNewAppointmentService = vi.fn();
const mockCloseOverlay = vi.mocked(closeOverlay);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseLocations = vi.mocked(useLocations);
const mockUseSession = vi.mocked(useSession);

const location = {
  uuid: 'location-uuid',
  display: 'Consulta externa',
  name: 'Consulta externa',
};

const createdService = {
  appointmentServiceId: 1,
  creatorName: 'Admin',
  description: '',
  durationMins: 30,
  endTime: '17:00:00',
  initialAppointmentStatus: 'Scheduled',
  location,
  maxAppointmentsLimit: 0,
  name: 'Medicina general',
  startTime: '08:00:00',
  uuid: 'created-service-uuid',
  color: '#0f62fe',
};

const catalogResponse = (data: unknown) => ({ status: 200, data }) as FetchResponse<unknown>;

vi.mock('../../hooks/useOverlay', async () => ({
  ...(await vi.importActual('../../hooks/useOverlay')),
  closeOverlay: vi.fn(),
}));

vi.mock('./appointment-services-hook', async () => ({
  ...(await vi.importActual('./appointment-services-hook')),
  useAppointmentServices: () => ({
    appointmentServiceInitialValue: mockAppointmentServiceState.initialValue,
    addNewAppointmentService: mockAddNewAppointmentService,
  }),
}));

const createInitialValue = () =>
  ({
    appointmentServiceId: 0,
    creatorName: '',
    description: '',
    durationMins: 0,
    endTime: '',
    initialAppointmentStatus: '',
    location: { uuid: '', display: '' },
    maxAppointmentsLimit: 0,
    name: '',
    startTime: '',
    uuid: '',
    color: '',
    startTimeTimeFormat: 'AM',
    endTimeTimeFormat: 'AM',
  }) as const;

async function fillValidServiceForm() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Appointment service name'), 'Medicina general');
  fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '08:00' } });
  fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '05:00' } });

  const timeFormats = screen.getAllByRole('combobox', { name: 'Time' });
  await user.selectOptions(timeFormats[0], 'AM');
  await user.selectOptions(timeFormats[1], 'PM');

  const duration = screen.getByRole('spinbutton', { name: 'Duration min' });
  await user.clear(duration);
  await user.type(duration, '30');

  await user.click(screen.getByRole('combobox', { name: 'Select location' }));
  await user.click(await screen.findByText(location.display));
  fireEvent.change(screen.getByLabelText('Appointment color'), { target: { value: '#0f62fe' } });

  const saveButton = screen.getByRole('button', { name: 'Save' });
  await waitFor(() => expect(saveButton).toBeEnabled());
  return { saveButton, user };
}

describe('AppointmentServices', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    mockAppointmentServiceState.initialValue = createInitialValue();
    mockAddNewAppointmentService.mockReset();
    mockCloseOverlay.mockReset();
    mockOpenmrsFetch.mockReset();
    mockShowSnackbar.mockClear();
    mockUseLocations.mockReset();
    mockUseSession.mockReset();
    mockUseLocations.mockReturnValue([location]);
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { uuid: 'user-uuid' },
    } as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockResolvedValue(catalogResponse([]));
    mockAddNewAppointmentService.mockResolvedValue({ status: 201, data: createdService });
  });

  it('creates a valid service once and closes only after a confirmed response', async () => {
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    await waitFor(() => expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1));
    expect(mockCloseOverlay).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(mockAddNewAppointmentService).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: '08:00:00',
        endTime: '17:00:00',
        locationUuid: location.uuid,
      }),
    );
  });

  it('shares the in-flight lock across rapid submissions', async () => {
    let resolveCreate!: (value: { status: number; data: typeof createdService }) => void;
    mockAddNewAppointmentService.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<AppointmentServices />);
    const { saveButton } = await fillValidServiceForm();

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1));
    resolveCreate({ status: 201, data: createdService });
    await waitFor(() => expect(mockCloseOverlay).toHaveBeenCalledTimes(1));
  });

  it('shares the create lock across two mounted service forms', async () => {
    mockAppointmentServiceState.initialValue = {
      ...createInitialValue(),
      name: 'Medicina general',
      startTime: '08:00',
      endTime: '05:00',
      endTimeTimeFormat: 'PM',
      durationMins: 30,
      location,
      color: '#0f62fe',
    };
    let resolveCatalog!: (value: FetchResponse<unknown>) => void;
    mockOpenmrsFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    );
    render(
      <>
        <AppointmentServices />
        <AppointmentServices />
      </>,
    );
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    await waitFor(() => {
      saveButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });

    fireEvent.click(saveButtons[0]);
    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(saveButtons[1]);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' })),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    resolveCatalog(catalogResponse([]));
    await waitFor(() => expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCloseOverlay).toHaveBeenCalledTimes(1));
  });

  it('reconciles a lost create response against the fresh catalog without a second POST', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(catalogResponse([]))
      .mockResolvedValueOnce(catalogResponse([createdService]));
    mockAddNewAppointmentService.mockRejectedValue(Object.assign(new Error('Gateway timeout'), { status: 504 }));
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    await waitFor(() => expect(mockCloseOverlay).toHaveBeenCalledTimes(1));
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('reconciles a pending create after remount without repeating the POST', async () => {
    mockAddNewAppointmentService.mockRejectedValue(new TypeError('Failed to fetch'));
    const firstRender = render(<AppointmentServices />);
    const firstForm = await fillValidServiceForm();

    await firstForm.user.click(firstForm.saveButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/Resultado pendiente de verificación|Result pending/iu);
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(loadAppointmentServiceCreationCheckpoint()).not.toBeNull();
    firstRender.unmount();

    mockOpenmrsFetch.mockResolvedValue(catalogResponse([createdService]));
    render(<AppointmentServices />);
    const secondForm = await fillValidServiceForm();

    await secondForm.user.click(secondForm.saveButton);

    await waitFor(() => expect(mockCloseOverlay).toHaveBeenCalledTimes(1));
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY)).toBeNull();
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('locks the form when neither the response nor the catalog can confirm the outcome', async () => {
    mockAddNewAppointmentService.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/Resultado pendiente de verificación|Result pending/iu);
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
    fireEvent.click(saveButton);
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(mockCloseOverlay).not.toHaveBeenCalled();
  });

  it('treats HTTP 499 as ambiguous and retains the checkpoint', async () => {
    mockAddNewAppointmentService.mockRejectedValue(Object.assign(new Error('Client closed request'), { status: 499 }));
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/Resultado pendiente de verificación|Result pending/iu);
    expect(loadAppointmentServiceCreationCheckpoint()).not.toBeNull();
    expect(saveButton).toBeDisabled();
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
  });

  it('reconciles 202 Accepted instead of treating it as persisted', async () => {
    mockAddNewAppointmentService.mockResolvedValue({ status: 202, data: undefined });
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/Resultado pendiente de verificación|Result pending/iu);
    expect(loadAppointmentServiceCreationCheckpoint()).not.toBeNull();
    expect(saveButton).toBeDisabled();
    expect(mockCloseOverlay).not.toHaveBeenCalled();
  });

  it('reconciles a malformed 200 response instead of treating it as persisted', async () => {
    mockAddNewAppointmentService.mockResolvedValue({ status: 200, data: { uuid: 'unexpected-service' } });
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/Resultado pendiente de verificación|Result pending/iu);
    expect(loadAppointmentServiceCreationCheckpoint()).not.toBeNull();
    expect(saveButton).toBeDisabled();
    expect(mockCloseOverlay).not.toHaveBeenCalled();
  });

  it('clears a definitively rejected create so the operator can retry once', async () => {
    mockAddNewAppointmentService.mockRejectedValueOnce(Object.assign(new Error('Bad request'), { status: 400 }));
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeEnabled());
    expect(loadAppointmentServiceCreationCheckpoint()).toBeNull();
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));

    mockAddNewAppointmentService.mockResolvedValueOnce({ status: 204, data: undefined });
    await user.click(saveButton);

    await waitFor(() => expect(mockCloseOverlay).toHaveBeenCalledTimes(1));
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(2);
  });

  it('locks a confirmed create when its safety checkpoint cannot be cleared', async () => {
    const removeItemSpy = vi.spyOn(globalThis.sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByText(/control de seguridad|safety checkpoint/iu)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(mockCloseOverlay).not.toHaveBeenCalled();
    removeItemSpy.mockRestore();
  });

  it('keeps a confirmed save distinct when closing the overlay fails', async () => {
    mockCloseOverlay.mockImplementation(() => {
      throw new Error('Overlay store unavailable');
    });
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    expect(await screen.findByText(/Servicio creado|Service created/iu)).toBeInTheDocument();
    expect(screen.queryByText(/Resultado pendiente de verificación|Result pending/iu)).not.toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    expect(mockAddNewAppointmentService).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('blocks a duplicate found during the preflight catalog check', async () => {
    mockOpenmrsFetch.mockResolvedValue(
      catalogResponse([
        {
          ...createdService,
          startTime: '10:00:00',
          endTime: '11:00:00',
          location: { uuid: 'other-location', display: 'Otra sede' },
        },
      ]),
    );
    render(<AppointmentServices />);
    const { saveButton, user } = await fillValidServiceForm();

    await user.click(saveButton);

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(mockAddNewAppointmentService).not.toHaveBeenCalled();
    expect(mockCloseOverlay).not.toHaveBeenCalled();
  });
});
