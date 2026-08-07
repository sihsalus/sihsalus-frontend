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

import { showModal, userHasAccess, useSession, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockCurrentVisit, mockPatient } from 'test-utils';

import StopVisitOverflowMenuItem from './stop-visit.component';

const mockUseVisit = vi.mocked(useVisit);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockShowModal = vi.mocked(showModal);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useVisit: vi.fn(),
  showModal: vi.fn(),
  useConfig: vi.fn(),
}));

describe('StopVisitOverflowMenuItem', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ user: { uuid: 'clinical-user' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) =>
      ['app:hoja.clinica', 'app:hoja.clinica.visitas.editar'].includes(privilege as string),
    );
  });

  it('should be able to stop current visit', async () => {
    const user = userEvent.setup();

    mockUseVisit.mockReturnValue({
      currentVisit: mockCurrentVisit,
    } as ReturnType<typeof useVisit>);

    render(
      React.createElement(StopVisitOverflowMenuItem, {
        patientUuid: mockPatient.id,
      }),
    );

    const endVisitButton = screen.getByRole('menuitem', { name: /End Visit/i });
    expect(endVisitButton).toBeInTheDocument();

    await user.click(endVisitButton);
    expect(mockShowModal).toHaveBeenCalledTimes(1);
  });
  it('should be able to show configured label in button to stop current visit', async () => {
    const user = userEvent.setup();

    mockUseVisit.mockReturnValue({
      currentVisit: mockCurrentVisit,
    } as ReturnType<typeof useVisit>);

    render(
      React.createElement(StopVisitOverflowMenuItem, {
        patientUuid: mockPatient.id,
      }),
    );

    const endVisitButton = screen.getByRole('menuitem', { name: /End visit/ });
    expect(endVisitButton).toBeInTheDocument();

    await user.click(endVisitButton);
    expect(mockShowModal).toHaveBeenCalledTimes(1);
  });

  it('does not expose clinical closure to admission staff', () => {
    mockUseVisit.mockReturnValue({
      currentVisit: mockCurrentVisit,
    } as ReturnType<typeof useVisit>);
    mockUserHasAccess.mockImplementation((privilege) =>
      ['app:home.admision', 'Edit Visits'].includes(privilege as string),
    );

    render(<StopVisitOverflowMenuItem patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('menuitem', { name: /End Visit/i })).not.toBeInTheDocument();
  });
});
