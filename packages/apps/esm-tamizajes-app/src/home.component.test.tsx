import { launchWorkspace2, navigate } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Home from './home.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockNavigate = vi.mocked(navigate);

describe('Tamizajes home', () => {
  it('opens patient search and navigates to the selected patient screening history', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn();

    render(<Home />);

    await user.click(screen.getByRole('button'));

    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'tamizajes-patient-search-workspace',
      expect.objectContaining({ initialQuery: '' }),
      {},
    );

    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1];
    workspaceProps.onPatientSelected('patient-uuid', {}, vi.fn(), closeWorkspace);

    expect(closeWorkspace).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/openmrs/spa/patient/patient-uuid/chart/tamizajes',
    });
  });

  it('keeps planned screening domains disabled', () => {
    render(<Home />);

    for (const title of ['Tamizaje TB', 'Diabetes / riesgo cardiovascular', 'Salud mental']) {
      fireEvent.click(screen.getByText(title));
    }

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('opens patient search from the available HIV history tile', () => {
    render(<Home />);

    fireEvent.click(screen.getByText('Tamizaje VIH'));

    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
  });
});
