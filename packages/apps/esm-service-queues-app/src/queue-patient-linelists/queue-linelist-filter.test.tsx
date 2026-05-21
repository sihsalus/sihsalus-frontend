import { useLayoutType, useVisitTypes } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockVisitTypes } from 'test-utils';

import QueueLinelistFilter from './queue-linelist-filter.workspace';

const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseVisitTypes = vi.mocked(useVisitTypes);

const workspaceProps = {
  closeWorkspace: vi.fn(),
  promptBeforeClosing: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  setTitle: vi.fn(),
};

describe('QueueLinelistFilter', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('tablet');
    mockUseVisitTypes.mockReturnValue(mockVisitTypes);
  });

  it('renders the form with filter elements', () => {
    render(<QueueLinelistFilter {...workspaceProps} />);

    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toBeInTheDocument();
    expect(screen.getByLabelText('Between')).toBeInTheDocument();
    expect(screen.getByLabelText('And')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByText("Use today's date")).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Select visit type/i })).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Apply filters')).toBeInTheDocument();
  });

  it('calls closePanel function when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn();

    render(<QueueLinelistFilter {...{ ...workspaceProps, closeWorkspace }} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('updates gender state when a radio button is selected', async () => {
    const user = userEvent.setup();

    render(<QueueLinelistFilter {...workspaceProps} />);

    const maleRadioButton = screen.getByLabelText('Male');
    await user.click(maleRadioButton);

    expect(maleRadioButton).toBeChecked();
  });

  it('updates startAge state when a number is entered', async () => {
    const user = userEvent.setup();
    render(<QueueLinelistFilter {...workspaceProps} />);

    const startAgeInput = screen.getByLabelText('Between');
    await user.type(startAgeInput, '10');

    expect(startAgeInput).toHaveValue(10);
  });

  it('should open the visit type dropdown and close after selection', async () => {
    const user = userEvent.setup();

    render(<QueueLinelistFilter {...workspaceProps} />);

    const visitTypeDropdown = screen.getByRole('combobox', { name: /Select visit type/i });
    await user.click(visitTypeDropdown);

    const type1Option = screen.getByText('Outpatient Visit');
    await user.click(type1Option);

    expect(visitTypeDropdown).toHaveTextContent('Open menu');
  });
});
