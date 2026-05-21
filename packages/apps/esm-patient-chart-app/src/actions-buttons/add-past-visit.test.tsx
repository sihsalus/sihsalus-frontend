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

import { showModal } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import AddPastVisitOverflowMenuItem from './add-past-visit.component';

const mockShowModal = vi.mocked(showModal);

describe('AddPastVisitOverflowMenuItem', () => {
  it('should launch the start past visit modal', async () => {
    const user = userEvent.setup();

    render(React.createElement(AddPastVisitOverflowMenuItem));

    const addPastVisitButton = screen.getByRole('menuitem', {
      name: /Add past visit/,
    });
    expect(addPastVisitButton).toBeInTheDocument();

    await user.click(addPastVisitButton);
    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockShowModal).toHaveBeenCalledWith(
      'start-visit-dialog',
      expect.objectContaining({
        launchPatientChart: undefined,
        patientUuid: undefined,
      }),
    );
  });
});
