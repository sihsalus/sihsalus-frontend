import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  showSnackbar,
  useConfig,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockLocations,
  mockPatient,
  mockProviders,
  mockSession,
  mockUseAppointmentServiceData,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';
import { useProviders } from '../hooks/useProviders';

import { saveAppointment } from './appointments-form.resource';
import AppointmentForm from './appointments-form.workspace';

const defaultProps = {
  context: 'creating',
  closeWorkspace: vi.fn(),
  patientUuid: mockPatient.id,
  promptBeforeClosing: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  setTitle: vi.fn(),
};

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockSaveAppointment = vi.mocked(saveAppointment);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLocations = vi.mocked(useLocations);
const mockUseProviders = vi.mocked(useProviders);
const mockUseSession = vi.mocked(useSession);

vi.mock('./appointments-form.resource', async () => ({
  ...(await vi.importActual('./appointments-form.resource')),
  saveAppointment: vi.fn(),
}));

vi.mock('../hooks/useProviders', async () => ({
  ...(await vi.importActual('../hooks/useProviders')),
  useProviders: vi.fn(),
}));

vi.mock('../workload/workload.resource', async () => ({
  ...(await vi.importActual('../workload/workload.resource')),
  getMonthlyCalendarDistribution: vi.fn(),
  useAppointmentSummary: vi.fn(),
  useCalendarDistribution: vi.fn(),
  useMonthlyCalendarDistribution: vi.fn().mockReturnValue([]),
  useMonthlyAppointmentSummary: vi.fn().mockReturnValue([]),
}));

describe('AppointmentForm', () => {
  const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3}Z|[+-]\d{2}:\d{2})$/;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveAppointment.mockResolvedValue({} as FetchResponse<unknown>);
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as FetchResponse<unknown>);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentTypes: ['Scheduled', 'WalkIn'],
    });
    mockUseLocations.mockReturnValue(mockLocations.data.results);
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseProviders.mockReturnValue({
      providers: mockProviders.data,
      isLoading: false,
      error: null,
      isValidating: false,
    });
  });

  it('renders the appointments form', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByLabelText(/select a location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select a service/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select the type of appointment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/write an additional note/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write any additional points here/i)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue(/\d{2}\/\d{2}\/\d{4}/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mosoriot/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /inpatient ward/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^am$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^pm$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /choose appointment type/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /scheduled/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /walkin/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeInTheDocument();
  });

  it('closes the workspace when the cancel button is clicked', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const cancelButton = screen.getByRole('button', { name: /Discard/i });
    await user.click(cancelButton);

    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('renders a success snackbar upon successfully scheduling an appointment', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({
      status: 200,
      statusText: 'Ok',
    } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const locationSelect = screen.getByRole('combobox', {
      name: /select a location/i,
    });
    const serviceSelect = screen.getByRole('combobox', {
      name: /select a service/i,
    });
    const appointmentTypeSelect = screen.getByRole('combobox', {
      name: /select the type of appointment/i,
    });
    const providerSelect = screen.getByRole('combobox', {
      name: /select a provider/i,
    });
    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    const timeInput = screen.getByRole('textbox', { name: /time/i });
    const timeFormat = screen.getByRole('combobox', { name: /time/i });
    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await user.selectOptions(locationSelect, ['Inpatient Ward']);
    await user.selectOptions(serviceSelect, ['Outpatient']);
    await user.selectOptions(appointmentTypeSelect, ['Scheduled']);
    await user.selectOptions(providerSelect, ['doctor - James Cook']);
    await user.clear(durationInput);
    await user.type(durationInput, '15');

    const time = '09:30';

    await user.type(timeInput, time);
    await user.tab();
    await user.selectOptions(timeFormat, 'AM');
    await user.click(saveButton);

    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
    expect(mockSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentKind: 'Scheduled',
        comments: '',
        dateAppointmentScheduled: expect.stringMatching(dateTimeRegex),
        endDateTime: expect.stringMatching(dateTimeRegex),
        locationUuid: 'b1a8b05e-3542-4037-bbd3-998ee9c40574',
        patientUuid: mockPatient.id,
        providers: [{ uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66' }],
        serviceUuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
        startDateTime: expect.stringMatching(dateTimeRegex),
        status: '',
        uuid: undefined,
      }),
      expect.anything(),
    );

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      isLowContrast: true,
      subtitle: 'It is now visible on the Appointments page',
      title: 'Appointment scheduled',
    });
  });

  it('renders an error snackbar if there was a problem scheduling an appointment', async () => {
    const user = userEvent.setup();

    const error = {
      message: 'Internal Server Error',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);
    mockSaveAppointment.mockRejectedValue(error);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const locationSelect = screen.getByRole('combobox', {
      name: /select a location/i,
    });
    const serviceSelect = screen.getByRole('combobox', {
      name: /select a service/i,
    });
    const appointmentTypeSelect = screen.getByRole('combobox', {
      name: /select the type of appointment/i,
    });
    const providerSelect = screen.getByRole('combobox', {
      name: /select a provider/i,
    });
    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    const timeInput = screen.getByRole('textbox', { name: /time/i });
    const timeFormat = screen.getByRole('combobox', { name: /time/i });
    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await user.selectOptions(locationSelect, ['Inpatient Ward']);
    await user.selectOptions(serviceSelect, ['Outpatient']);
    await user.selectOptions(appointmentTypeSelect, ['Scheduled']);
    await user.selectOptions(providerSelect, ['doctor - James Cook']);
    await user.clear(durationInput);
    await user.type(durationInput, '15');

    const time = '09:30';

    await user.type(timeInput, time);
    await user.tab();
    await user.selectOptions(timeFormat, 'AM');
    await user.click(saveButton);

    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
    expect(mockSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentKind: 'Scheduled',
        comments: '',
        dateAppointmentScheduled: expect.stringMatching(dateTimeRegex),
        endDateTime: expect.stringMatching(dateTimeRegex),
        locationUuid: 'b1a8b05e-3542-4037-bbd3-998ee9c40574',
        patientUuid: mockPatient.id,
        providers: [{ uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66' }],
        serviceUuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
        startDateTime: expect.stringMatching(dateTimeRegex),
        status: '',
        uuid: undefined,
      }),
      expect.anything(),
    );

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'Internal Server Error',
      title: 'Error scheduling appointment',
    });
  });
});
