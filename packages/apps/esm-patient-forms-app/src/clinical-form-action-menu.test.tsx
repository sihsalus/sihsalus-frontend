import { ActionMenuButton } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import React from 'react';

import ClinicalFormActionMenu from './clinical-form-action-menu.component';

void React;

const mockActionMenuButton = vi.mocked(ActionMenuButton);
const mockUseLaunchWorkspaceRequiringVisit = useLaunchWorkspaceRequiringVisit as vi.Mock;

mockActionMenuButton.mockImplementation(({ label }) => <button type="button">{label}</button>);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    useLaunchWorkspaceRequiringVisit: vi.fn(),
  };
});

beforeEach(() => {
  mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(vi.fn());
});

test('should display clinical form action menu button', () => {
  render(<ClinicalFormActionMenu />);

  expect(screen.getByRole('button', { name: /clinical forms/i })).toBeInTheDocument();
});
