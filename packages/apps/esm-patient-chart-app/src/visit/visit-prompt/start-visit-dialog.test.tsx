import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import StartVisitDialog from './start-visit-dialog.component';

const mockNavigate = vi.hoisted(() => vi.fn());

const defaultProps = {
  patientUuid: 'some-uuid',
  closeModal: vi.fn(),
  visitType: null,
};

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
  };
});

vi.mock('@openmrs/esm-framework', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-framework');

  return {
    ...originalModule,
    navigate: mockNavigate,
  };
});

describe('StartVisit', () => {
  test('should launch start visit form', async () => {
    const user = userEvent.setup();

    renderStartVisitDialog();

    expect(
      screen.getByText(
        `You can't add data to the patient chart without an active visit. Choose from one of the options below to continue.`,
      ),
    ).toBeInTheDocument();

    const startNewVisitButton = screen.getByRole('button', { name: /Start new visit/i });

    await user.click(startNewVisitButton);

    expect(launchPatientWorkspace).toHaveBeenCalledWith('start-visit-workspace-form', {
      openedFrom: 'patient-chart-start-visit',
    });
  });

  test('should launch edit past visit form', async () => {
    const user = userEvent.setup();

    renderStartVisitDialog({ visitType: 'past' });

    expect(
      screen.getByText(
        `You can add a new past visit or update an old one. Choose from one of the options below to continue.`,
      ),
    ).toBeInTheDocument();

    const editPastVisitButton = screen.getByRole('button', { name: /Edit past visit/i });

    await user.click(editPastVisitButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/some-uuid/chart/Visits' });
  });
});

function renderStartVisitDialog(props = {}) {
  render(<StartVisitDialog {...defaultProps} {...props} />);
}
