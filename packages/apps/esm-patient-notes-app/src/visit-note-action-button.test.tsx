import { ActionMenuButton2, type LayoutType, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { mockPatient } from 'test-utils';
import VisitNoteActionButton from './visit-note-action-button.extension';

const mockActionMenuButton2 = vi.mocked(ActionMenuButton2);
const mockUseLayoutType = vi.mocked(useLayoutType);

mockActionMenuButton2.mockImplementation(({ label }) => <button type="button">{label}</button>);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    useStartVisitIfNeeded: vi.fn(() => () => Promise.resolve(true)),
  };
});

describe('VisitNoteActionButton', () => {
  it('should display tablet view', async () => {
    mockUseLayoutType.mockReturnValue('tablet');

    render(
      <VisitNoteActionButton
        groupProps={{ patientUuid: 'patient-uuid', mutateVisitContext: null, patient: null, visitContext: null }}
      />,
    );
  });

  it('should display desktop view', async () => {
    mockUseLayoutType.mockReturnValue('desktop' as LayoutType);

    render(
      <VisitNoteActionButton
        groupProps={{
          patientUuid: mockPatient.id,
          patient: mockPatient as unknown as fhir.Patient,
          visitContext: null,
          mutateVisitContext: null,
        }}
      />,
    );

    const visitNoteButton = screen.getByRole('button', { name: /Note/i });
    expect(visitNoteButton).toBeInTheDocument();
  });
});
