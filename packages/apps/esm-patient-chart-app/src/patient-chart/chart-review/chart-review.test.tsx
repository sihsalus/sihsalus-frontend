import {
  type AssignedExtension,
  ExtensionSlot,
  type ExtensionSlotState,
  useExtensionSlotMeta,
  useExtensionStore,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mockPatient } from 'test-utils';

import ChartReview from './chart-review.component';

const mockUseExtensionStore = vi.mocked(useExtensionStore);
const mockUseExtensionSlotMeta = vi.mocked(useExtensionSlotMeta);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  return {
    ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
    useNavGroups: vi.fn().mockReturnValue({ navGroups: [] }),
  };
});

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  Redirect: vi.fn(),
  useMatch: vi.fn().mockReturnValue({
    params: {
      url: '/patient/8673ee4f-e2ab-4077-ba55-4980f408773e/chart',
      view: 'Patient Summary',
    },
  }),
}));

function slotMetaFromStore(store, slotName) {
  return Object.fromEntries(
    store.slots[slotName].assignedExtensions.map((e) => {
      return [e.name, e.meta];
    }),
  );
}

describe('ChartReview', () => {
  beforeEach(() => {
    mockExtensionSlot.mockImplementation(({ children }): React.JSX.Element => {
      if (typeof children === 'function') {
        return (
          <>
            {children({
              id: 'mocked-extension',
              meta: {},
              moduleName: '@openmrs/esm-patient-chart-app',
              name: 'mocked-extension',
              config: {},
            } as AssignedExtension)}
          </>
        );
      }

      return <>{children ?? null}</>;
    });
  });

  test('renders a grid-based layout', () => {
    const mockStore = {
      slots: {
        'patient-chart-dashboard-slot': {
          assignedExtensions: [
            {
              name: 'charts-summary-dashboard',
              meta: {
                slot: 'patient-chart-summary-dashboard-slot',
                path: 'Patient Summary',
                title: 'Patient Summary',
              },
            },
            {
              name: 'test-results-summary-dashboard',
              meta: {
                slot: 'patient-chart-test-results-dashboard-slot',
                path: 'Test Results',
                title: 'Test Results',
              },
            },
          ] as unknown as AssignedExtension[],
        },
        'patient-chart-summary-dashboard-slot': {
          assignedExtensions: [],
        },
      } as Record<string, ExtensionSlotState>,
    };

    mockUseExtensionStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useExtensionStore>);
    mockUseExtensionSlotMeta.mockImplementation((slotName) => slotMetaFromStore(mockStore, slotName));

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ChartReview patient={mockFhirPatient} patientUuid={mockPatient.id} view="Patient Summary" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading')).toHaveTextContent(/Patient summary/i);
  });
});
