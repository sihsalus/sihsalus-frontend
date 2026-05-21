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

import { useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockCurrentVisit } from 'test-utils';

import CancelVisitOverflowMenuItem from './cancel-visit.component';

const mockUseVisit = vi.mocked(useVisit);

describe('CancelVisitOverflowMenuItem', () => {
  it('should launch cancel visit dialog box', async () => {
    const user = userEvent.setup();

    mockUseVisit.mockReturnValueOnce({
      currentVisit: mockCurrentVisit,
    } as ReturnType<typeof useVisit>);

    render(
      React.createElement(CancelVisitOverflowMenuItem, {
        patientUuid: 'some-uuid',
      }),
    );

    const cancelVisitButton = screen.getByRole('menuitem', {
      name: /cancel visit/i,
    });
    expect(cancelVisitButton).toBeInTheDocument();

    await user.click(cancelVisitButton);
  });
});
