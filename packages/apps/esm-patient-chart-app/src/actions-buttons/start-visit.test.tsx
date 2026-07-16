vi.mock('@carbon/react', async () => {
  const actual = await vi.importActual('@carbon/react');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    OverflowMenuItem: React.forwardRef<
      HTMLButtonElement,
      React.ComponentPropsWithoutRef<'button'> & { itemText?: React.ReactNode }
    >(function MockOverflowMenuItem({ itemText, onClick, ...props }, ref) {
      return (
        <button {...props} onClick={onClick} ref={ref} role="menuitem" type="button">
          {itemText}
        </button>
      );
    }),
  };
});

import {
  getDefaultsFromConfigSchema,
  useConfig,
  userHasAccess,
  useSession,
  useVisit,
  type VisitReturnType,
} from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockPatient } from 'test-utils';

import { type ChartConfig, esmPatientChartSchema } from '../config-schema';

import StartVisitOverflowMenuItem from './start-visit.component';

const mockUseConfig = vi.mocked(useConfig<ChartConfig>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseVisit = vi.mocked(useVisit);
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
  };
});

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(esmPatientChartSchema),
});

mockUseVisit.mockReturnValue({
  currentVisit: null,
} as VisitReturnType);

describe('StartVisitOverflowMenuItem', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      user: {
        privileges: [{ display: 'app:home.admision' }],
      },
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');
  });

  it('should launch the start visit form', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(StartVisitOverflowMenuItem, {
        patient: mockFhirPatient,
      }),
    );

    const startVisitButton = screen.getByRole('menuitem', {
      name: /start visit/i,
    });
    expect(startVisitButton).toBeInTheDocument();

    await user.click(startVisitButton);
    expect(launchPatientWorkspace).toHaveBeenCalledTimes(1);
    expect(launchPatientWorkspace).toHaveBeenCalledWith('start-visit-workspace-form', {
      openedFrom: 'patient-chart-start-visit',
    });
  });

  it('should not show start visit button for a deceased patient', () => {
    render(
      React.createElement(StartVisitOverflowMenuItem, {
        patient: {
          ...mockFhirPatient,
          deceasedDateTime: '2023-05-07T10:20:30Z',
        },
      }),
    );

    const startVisitButton = screen.queryByRole('menuitem', {
      name: /start visit/i,
    });
    expect(startVisitButton).not.toBeInTheDocument();
  });

  it('should not show start visit button without ADT or visit edit privileges', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(
      React.createElement(StartVisitOverflowMenuItem, {
        patient: mockFhirPatient,
      }),
    );

    expect(screen.queryByRole('menuitem', { name: /start visit/i })).not.toBeInTheDocument();
  });
});
