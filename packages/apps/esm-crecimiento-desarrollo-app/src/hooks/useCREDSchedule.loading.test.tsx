import { usePatient } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useAppointmentsCRED from './useAppointmentsCRED';
import { useCREDSchedule } from './useCREDSchedule';
import useEncountersCRED from './useEncountersCRED';

vi.mock('./useAppointmentsCRED');
vi.mock('./useEncountersCRED');

let patientState: ReturnType<typeof usePatient>;
let historyState: ReturnType<typeof useEncountersCRED>;
let appointmentsState: ReturnType<typeof useAppointmentsCRED>;

beforeEach(() => {
  patientState = {
    patient: {
      resourceType: 'Patient',
      id: 'synthetic-child',
      birthDate: '2026-09-01',
    },
    patientUuid: 'synthetic-child',
    isLoading: false,
    error: null,
  };
  vi.mocked(usePatient).mockReturnValue(patientState);
  historyState = {
    encounters: [],
    isLoading: false,
    error: null,
    controlNumberError: null,
    mutate: vi.fn(),
  };
  vi.mocked(useEncountersCRED).mockReturnValue(historyState);
  appointmentsState = {
    appointments: [],
    isLoading: false,
    error: undefined,
  };
  vi.mocked(useAppointmentsCRED).mockReturnValue(appointmentsState);
});

it.each([
  'patient',
  'encounters',
  'appointments',
] as const)('waits for %s even if partial data are already available', (source) => {
  if (source === 'patient')
    vi.mocked(usePatient).mockReturnValue({
      ...patientState,
      isLoading: true,
    });
  if (source === 'encounters')
    vi.mocked(useEncountersCRED).mockReturnValue({
      ...historyState,
      isLoading: true,
    });
  if (source === 'appointments')
    vi.mocked(useAppointmentsCRED).mockReturnValue({
      ...appointmentsState,
      isLoading: true,
    });
  const { result } = renderHook(() => useCREDSchedule('synthetic-child'));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.nextDueControl).toBeNull();
  expect(result.current.controls).toEqual([]);
});

it.each([
  'patient',
  'encounters',
  'controlNumbers',
  'appointments',
] as const)('does not recommend a new control when %s fail', (source) => {
  const error = new Error('Synthetic read failure');
  if (source === 'patient')
    vi.mocked(usePatient).mockReturnValue({
      ...patientState,
      error,
    });
  if (source === 'encounters')
    vi.mocked(useEncountersCRED).mockReturnValue({
      ...historyState,
      error,
    });
  if (source === 'controlNumbers')
    vi.mocked(useEncountersCRED).mockReturnValue({
      ...historyState,
      controlNumberError: error,
    });
  if (source === 'appointments')
    vi.mocked(useAppointmentsCRED).mockReturnValue({
      ...appointmentsState,
      error,
    });
  const { result } = renderHook(() => useCREDSchedule('synthetic-child'));
  expect(result.current.error).toBe(error);
  expect(result.current.nextDueControl).toBeNull();
  expect(result.current.controls).toEqual([]);
});

it('recalculates from the persisted control number after recovery', () => {
  vi.mocked(useEncountersCRED).mockReturnValue({
    ...historyState,
    controlNumberError: new Error('Synthetic failure'),
  });
  const { result, rerender } = renderHook(() => useCREDSchedule('synthetic-child'));
  expect(result.current.nextDueControl).toBeNull();
  vi.mocked(useEncountersCRED).mockReturnValue({
    encounters: [
      {
        uuid: 'control-four',
        controlNumber: 4,
        encounterDatetime: '2026-09-10T15:00:00Z',
        visit: { uuid: 'synthetic-visit' },
      },
    ],
    error: null,
    controlNumberError: null,
    isLoading: false,
    mutate: vi.fn(),
  });
  rerender();
  expect(result.current.nextDueControl?.controlNumber).toBe(5);
});
