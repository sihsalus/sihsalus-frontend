import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import StaffScheduling from './staff-scheduling.component';
import {
  type ResourceAvailability,
  type StaffSchedulingData,
  type StaffShift,
  saveStaffSchedulingData,
  useSchedulingReferenceData,
  useStaffSchedulingData,
} from './staff-scheduling.resource';

vi.mock('./staff-scheduling.resource', async () => ({
  ...(await vi.importActual('./staff-scheduling.resource')),
  saveStaffSchedulingData: vi.fn(),
  useSchedulingReferenceData: vi.fn(),
  useStaffSchedulingData: vi.fn(),
}));

// These tests exercise the schedule view for an authorized operator, not the shared RBAC guard.
vi.mock('@sihsalus/esm-rbac', async () => ({
  ...(await vi.importActual('@sihsalus/esm-rbac')),
  RequireModulePrivilege: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockUseStaffSchedulingData = vi.mocked(useStaffSchedulingData);
const mockUseSchedulingReferenceData = vi.mocked(useSchedulingReferenceData);

const availability: ResourceAvailability = {
  id: 'availability-synthetic',
  locationUuid: 'location-synthetic',
  locationName: 'Consultorio sintético',
  daysOfWeek: [1, 3],
  startTime: '08:00',
  endTime: '10:00',
  active: true,
};

const shift: StaffShift = {
  id: 'shift-synthetic',
  date: '2026-11-02',
  providerUuid: 'provider-synthetic',
  providerName: 'Profesional sintético',
  locationUuid: availability.locationUuid,
  locationName: availability.locationName,
  serviceUuid: 'service-synthetic',
  serviceName: 'Servicio sintético',
  startTime: '08:00',
  endTime: '09:10',
  slotMinutes: 30,
  capacityPerSlot: 3,
  status: 'published',
};

const roster: StaffSchedulingData = {
  version: 7,
  updatedAt: '2026-11-01T12:00:00Z',
  resourceAvailabilities: [availability],
  shifts: [shift],
};

const rosterState = {
  schedulingData: roster,
  settingUuid: 'roster-setting',
  isLoading: false,
  error: null,
  mutate: vi.fn(),
};

const references = {
  providers: [],
  locations: [],
  services: [],
  isLoading: false,
  error: undefined,
};

describe('staff schedule view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStaffSchedulingData.mockReturnValue(rosterState);
    mockUseSchedulingReferenceData.mockReturnValue(references);
  });

  it.each(['roster', 'reference data'])('blocks editing while %s is loading', (source) => {
    if (source === 'roster') {
      mockUseStaffSchedulingData.mockReturnValue({ ...rosterState, isLoading: true });
    } else {
      mockUseSchedulingReferenceData.mockReturnValue({ ...references, isLoading: true });
    }

    render(<StaffScheduling />);

    expect(screen.getByText('Cargando programación de turnos')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(saveStaffSchedulingData).not.toHaveBeenCalled();
  });

  it.each(['roster', 'reference data'])('blocks editing when %s cannot be loaded', (source) => {
    const error = new Error('Synthetic unavailable schedule');
    if (source === 'roster') {
      mockUseStaffSchedulingData.mockReturnValue({ ...rosterState, error });
    } else {
      mockUseSchedulingReferenceData.mockReturnValue({ ...references, error });
    }

    render(<StaffScheduling />);

    expect(screen.getByText('No se pudo cargar la programación')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(saveStaffSchedulingData).not.toHaveBeenCalled();
  });

  it('shows the location, weekdays and hours of its availability', () => {
    render(<StaffScheduling />);

    const row = screen.getByRole('row', { name: /Consultorio sintético/ });
    expect(within(row).getByRole('cell', { name: 'Lun, Mié' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: '08:00 - 10:00' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: 'Activa' })).toBeInTheDocument();
  });

  it('distinguishes shifts inside and outside the available hours', async () => {
    mockUseStaffSchedulingData.mockReturnValue({
      ...rosterState,
      schedulingData: {
        ...roster,
        shifts: [
          shift,
          {
            ...shift,
            id: 'outside-shift',
            providerName: 'Profesional fuera de horario',
            startTime: '11:00',
            endTime: '12:00',
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(<StaffScheduling />);

    await user.click(screen.getByRole('tab', { name: 'Turnos' }));

    const validRow = screen.getByRole('row', { name: /Profesional sintético/ });
    expect(within(validRow).getByRole('cell', { name: '08:00 - 09:10' })).toBeInTheDocument();
    expect(within(validRow).getByText('Válido')).toBeInTheDocument();
    const outsideRow = screen.getByRole('row', { name: /Profesional fuera de horario/ });
    expect(within(outsideRow).getByRole('cell', { name: '11:00 - 12:00' })).toBeInTheDocument();
    expect(within(outsideRow).getByText('Fuera de horario')).toBeInTheDocument();
  });

  it('shows complete published slots and their capacity, excluding suspended shifts', async () => {
    mockUseStaffSchedulingData.mockReturnValue({
      ...rosterState,
      schedulingData: {
        ...roster,
        shifts: [
          { ...shift, id: 'suspended-shift', providerName: 'Profesional suspendido', status: 'suspended' },
          shift,
        ],
      },
    });
    const user = userEvent.setup();
    render(<StaffScheduling />);

    await user.click(screen.getByRole('tab', { name: 'Cupos' }));

    expect(screen.getByText('2 publicados')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    for (const hours of ['08:00 - 08:30', '08:30 - 09:00']) {
      const row = within(table).getByRole('row', { name: new RegExp(hours) });
      expect(within(row).getByRole('cell', { name: 'Profesional sintético' })).toBeInTheDocument();
      expect(within(row).getByRole('cell', { name: 'Servicio sintético' })).toBeInTheDocument();
      expect(within(row).getByRole('cell', { name: '3' })).toBeInTheDocument();
    }
    expect(within(table).queryByText('Profesional suspendido')).not.toBeInTheDocument();
  });
});
