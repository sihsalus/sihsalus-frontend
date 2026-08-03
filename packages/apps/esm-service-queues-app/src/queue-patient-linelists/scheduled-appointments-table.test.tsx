import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAppointmentsData } from 'test-utils';

import englishTranslations from '../../translations/en.json';
import spanishTranslations from '../../translations/es.json';
import { type ConfigObject, configSchema } from '../config-schema';
import {
  ALL_APPOINTMENT_STATUSES,
  updateSelectedAppointmentStatus,
  useServiceQueuesStore,
} from '../store/store';

import AppointmentsTable from './scheduled-appointments-table.component';

const translationMock = vi.hoisted(() => {
  const createTranslator = (values: Record<string, string>) => {
    return (key: string, defaultValue?: string, options: Record<string, unknown> = {}) => {
      let translatedValue = values[key] ?? defaultValue ?? key;

      Object.entries(options).forEach(([name, value]) => {
        translatedValue = translatedValue.replaceAll(`{{${name}}}`, String(value));
      });

      return translatedValue;
    };
  };
  const state = { t: createTranslator({}) };
  const setValues = (values: Record<string, string>) => {
    state.t = createTranslator(values);
  };

  return { setValues, state };
});

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    useTranslation: () => ({ t: translationMock.state.t }),
  };
});

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseAppointments = vi.hoisted(() => vi.fn());

vi.mock('./queue-linelist.resource', () => ({
  useAppointments: mockUseAppointments,
}));

describe('AppointmentsTable', () => {
  beforeEach(() => {
    translationMock.setValues({});
    updateSelectedAppointmentStatus(ALL_APPOINTMENT_STATUSES);
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries: mockAppointmentsData.data,
      isLoading: false,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentStatuses: ['Scheduled', 'Completed'],
    });
  });

  it('renders appointments when loading is complete', () => {
    render(<AppointmentsTable />);

    const appointmentName = screen.getByText(/charles babbage/i);
    expect(appointmentName).toBeInTheDocument();
  });

  it('filters by status in Spanish and restores every appointment when Todo is selected', async () => {
    const user = userEvent.setup();
    translationMock.setValues(spanishTranslations);
    expect(spanishTranslations.all).toBe('Todo');
    const scheduledAppointment = mockAppointmentsData.data[0];
    const completedAppointment = {
      ...mockAppointmentsData.data[1],
      status: 'Completed',
    };
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries: [scheduledAppointment, completedAppointment],
      isLoading: false,
    });

    render(<AppointmentsTable />);

    const statusDropdown = screen.getByRole('combobox', { name: `${spanishTranslations.status}:` });
    expect(statusDropdown).toHaveTextContent(spanishTranslations.all);
    expect(screen.getByText(scheduledAppointment.patient.name)).toBeInTheDocument();
    expect(screen.getByText(completedAppointment.patient.name)).toBeInTheDocument();

    await user.click(statusDropdown);
    await user.click(screen.getByRole('option', { name: 'Completed' }));

    expect(screen.queryByText(scheduledAppointment.patient.name)).not.toBeInTheDocument();
    expect(screen.getByText(completedAppointment.patient.name)).toBeInTheDocument();
    expect(statusDropdown).toHaveTextContent('Completed');

    await user.click(statusDropdown);
    await user.click(screen.getByRole('option', { name: spanishTranslations.all }));

    expect(screen.getByText(scheduledAppointment.patient.name)).toBeInTheDocument();
    expect(screen.getByText(completedAppointment.patient.name)).toBeInTheDocument();
    expect(statusDropdown).toHaveTextContent(spanishTranslations.all);
  });

  it('falls back to Todo when the stored status is no longer configured', () => {
    translationMock.setValues(spanishTranslations);
    updateSelectedAppointmentStatus('Removed');

    render(<AppointmentsTable />);

    expect(screen.getByRole('combobox', { name: `${spanishTranslations.status}:` })).toHaveTextContent(
      spanishTranslations.all,
    );
    expect(screen.getByText(/charles babbage/i)).toBeInTheDocument();
  });

  it('keeps status IDs stable while all three visible options follow a dynamic locale change', async () => {
    const user = userEvent.setup();
    const scheduledAppointment = mockAppointmentsData.data[0];
    const completedAppointment = {
      ...mockAppointmentsData.data[1],
      status: 'Completed',
    };
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries: [scheduledAppointment, completedAppointment],
      isLoading: false,
    });
    translationMock.setValues(spanishTranslations);

    const { result: queueState } = renderHook(() => useServiceQueuesStore());
    const { rerender } = render(<AppointmentsTable />);
    const spanishDropdown = screen.getByRole('combobox', { name: `${spanishTranslations.status}:` });

    await user.click(spanishDropdown);
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      spanishTranslations.all,
      'Scheduled',
      'Completed',
    ]);
    await user.click(screen.getByRole('option', { name: 'Completed' }));

    expect(queueState.current.selectedAppointmentStatus).toBe('Completed');
    expect(screen.queryByText(scheduledAppointment.patient.name)).not.toBeInTheDocument();
    expect(screen.getByText(completedAppointment.patient.name)).toBeInTheDocument();

    translationMock.setValues(englishTranslations);
    rerender(<AppointmentsTable />);

    const englishDropdown = screen.getByRole('combobox', { name: `${englishTranslations.status}:` });
    expect(englishDropdown).toHaveTextContent('Completed');
    expect(queueState.current.selectedAppointmentStatus).toBe('Completed');
    await user.click(englishDropdown);
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      englishTranslations.all,
      'Scheduled',
      'Completed',
    ]);
    await user.click(screen.getByRole('option', { name: englishTranslations.all }));

    expect(ALL_APPOINTMENT_STATUSES).toBe('');
    expect(queueState.current.selectedAppointmentStatus).toBe(ALL_APPOINTMENT_STATUSES);
    expect(screen.getByText(scheduledAppointment.patient.name)).toBeInTheDocument();
    expect(screen.getByText(completedAppointment.patient.name)).toBeInTheDocument();

    translationMock.setValues(spanishTranslations);
    rerender(<AppointmentsTable />);

    expect(screen.getByRole('combobox', { name: `${spanishTranslations.status}:` })).toHaveTextContent(
      spanishTranslations.all,
    );
    expect(queueState.current.selectedAppointmentStatus).toBe(ALL_APPOINTMENT_STATUSES);
  });

  it.each([undefined, null])('renders safely when appointment entries are %s', (appointmentQueueEntries) => {
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries,
      isLoading: false,
    });

    expect(() => render(<AppointmentsTable />)).not.toThrow();
  });
});
