import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DispensingDashboard from './dispensing-dashboard.component';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  realtimeHook: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('@carbon/react', () => ({
  InlineNotification: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@openmrs/esm-framework', () => ({
  fhirBaseUrl: '/openmrs/ws/fhir2/R4',
  showSnackbar: mocks.showSnackbar,
  useConfig: () => ({
    dispenseBehavior: { allowModifyingPrescription: true, restrictTotalQuantityDispensed: false },
    enableRealtimeMedicationOrderNotifications: true,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mocks.mutate }),
}));

vi.mock('../fill-prescription/fill-prescription-button.component', () => ({
  default: () => <div>Fill prescription</div>,
}));

vi.mock('../pharmacy-header/pharmacy-header.component', () => ({
  PharmacyHeader: () => <h1>Pharmacy</h1>,
}));

vi.mock('../pharmacy-notifications.resource', () => ({
  useMedicationOrderNotifications: mocks.realtimeHook,
}));

vi.mock('../prescriptions/prescription-tab-lists.component', () => ({
  default: () => <div>Prescription tabs</div>,
}));

describe('Dispensing dashboard realtime notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the pharmacy worklist and shows a generic notice for a new medication order', () => {
    render(<DispensingDashboard />);

    expect(screen.getByRole('heading', { name: 'Pharmacy' })).toBeInTheDocument();
    expect(mocks.realtimeHook).toHaveBeenCalledWith(true, expect.any(Function));
    const onOrderCreated = mocks.realtimeHook.mock.calls[0][1] as () => void;

    act(() => onOrderCreated());

    expect(mocks.mutate).toHaveBeenCalledOnce();
    const isPharmacyWorklistKey = mocks.mutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(isPharmacyWorklistKey('/openmrs/ws/fhir2/R4/Encounter?_query=encountersWithMedicationRequests')).toBe(
      true,
    );
    expect(isPharmacyWorklistKey('/openmrs/ws/fhir2/R4/MedicationRequest?encounter=one')).toBe(false);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'info',
      title: 'New medication order',
      subtitle: 'A new medication order was added to the pharmacy worklist.',
    });
  });
});
