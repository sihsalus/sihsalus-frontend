import { ActionMenuButton2, UserHasAccess } from '@openmrs/esm-framework';
import { useStartVisitIfNeeded } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import React from 'react';

import ClinicalFormActionButton from './clinical-form-action-button.component';

void React;

const mockActionMenuButton2 = vi.mocked(ActionMenuButton2);
const mockUserHasAccess = vi.mocked(UserHasAccess);
const mockUseStartVisitIfNeeded = useStartVisitIfNeeded as vi.Mock;

mockActionMenuButton2.mockImplementation(({ label }: { label?: React.ReactNode }) => (
  <button type="button">{label}</button>
));
mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);

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
  expect(mockUserHasAccess.mock.calls.at(-1)?.[0]).toMatchObject({
    privilege: 'app:hoja.clinica.formulariosClinicos',
  });
});

test('does not display clinical forms when access is denied', () => {
  mockUserHasAccess.mockReturnValueOnce(null);

  render(
    <ClinicalFormActionButton
      groupProps={{ patientUuid: 'patient-uuid', patient: null, visitContext: null, mutateVisitContext: null }}
    />,
  );

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
