import { ActionMenuButton2 } from '@openmrs/esm-framework';
import { useStartVisitIfNeeded } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import React from 'react';

import ClinicalFormActionButton from './clinical-form-action-button.component';

void React;

const mockActionMenuButton2 = vi.mocked(ActionMenuButton2);
const mockUseStartVisitIfNeeded = useStartVisitIfNeeded as vi.Mock;

mockActionMenuButton2.mockImplementation(({ label }: { label?: React.ReactNode }) => (
  <button type="button">{label}</button>
));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    useStartVisitIfNeeded: vi.fn(),
  };
});

beforeEach(() => {
  mockUseStartVisitIfNeeded.mockReturnValue(vi.fn().mockResolvedValue(true));
});

test('should display clinical form action button', () => {
  render(
    <ClinicalFormActionButton
      groupProps={{
        patientUuid: 'patient-uuid',
        patient: null,
        visitContext: null,
        mutateVisitContext: null,
      }}
    />,
  );

  expect(screen.getByRole('button', { name: /clinical forms/i })).toBeInTheDocument();
});
