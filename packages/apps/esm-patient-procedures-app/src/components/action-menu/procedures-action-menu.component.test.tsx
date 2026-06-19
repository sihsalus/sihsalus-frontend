import { launchWorkspace2, showModal, useLayoutType } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockProceduresResponse } from 'test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Procedure } from '../../types';
import { ProceduresActionMenu } from './procedures-action-menu.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowModal = vi.mocked(showModal);
const mockUseLayoutType = vi.mocked(useLayoutType);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  launchWorkspace2: vi.fn(),
  showModal: vi.fn().mockReturnValue(vi.fn()),
  useLayoutType: vi.fn().mockReturnValue('small-desktop'),
  userHasAccess: vi.fn().mockReturnValue(true),
}));

const mockProcedure = mockProceduresResponse.results[0] as Procedure;
const patientUuid = '8673ee4f-e2ab-4077-ba55-4980f408773e';

const defaultProps = {
  procedure: mockProcedure,
  patientUuid,
};

function getMenuTrigger() {
  return screen.getByRole('button', { name: /options/i });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement | null> {
  const trigger = getMenuTrigger();
  await user.click(trigger);
  const panelId = trigger.getAttribute('aria-controls');
  return panelId ? document.getElementById(panelId) : null;
}

describe('Procedures Action Menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockShowModal.mockReturnValue(vi.fn());
  });

  it('renders the overflow menu', () => {
    render(<ProceduresActionMenu {...defaultProps} />);

    expect(getMenuTrigger()).toBeInTheDocument();
  });

  it('renders Edit and Delete menu items after opening the menu', async () => {
    const user = userEvent.setup();
    render(<ProceduresActionMenu {...defaultProps} />);

    const panel = await openMenu(user);
    expect(panel).toBeTruthy();
    const menuPanel = panel as HTMLElement;

    expect(within(menuPanel).getByText('Edit')).toBeInTheDocument();
    expect(within(menuPanel).getByText('Delete')).toBeInTheDocument();
  });

  it('clicking Edit launches the procedures form workspace', async () => {
    const user = userEvent.setup();
    render(<ProceduresActionMenu {...defaultProps} />);

    const panel = await openMenu(user);
    expect(panel).toBeTruthy();
    const menuPanel = panel as HTMLElement;

    await user.click(within(menuPanel).getByText('Edit'));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('procedures-form-workspace', {
      procedure: mockProcedure,
      formContext: 'editing',
    });
  });

  it('clicking Delete opens the confirmation modal', async () => {
    const user = userEvent.setup();
    render(<ProceduresActionMenu {...defaultProps} />);

    const panel = await openMenu(user);
    expect(panel).toBeTruthy();
    const menuPanel = panel as HTMLElement;

    await user.click(within(menuPanel).getByText('Delete'));

    expect(mockShowModal).toHaveBeenCalledWith(
      'procedure-delete-confirmation-dialog',
      expect.objectContaining({
        procedureUuid: mockProcedure.uuid,
        patientUuid,
      }),
    );
  });

  it('uses lg size on tablet layout', () => {
    mockUseLayoutType.mockReturnValue('tablet');

    render(<ProceduresActionMenu {...defaultProps} />);

    expect(getMenuTrigger()).toHaveClass('cds--overflow-menu--lg');
  });

  it('uses sm size on desktop layout', () => {
    mockUseLayoutType.mockReturnValue('small-desktop');

    render(<ProceduresActionMenu {...defaultProps} />);

    expect(getMenuTrigger()).toHaveClass('cds--overflow-menu--sm');
  });
});
