import { launchWorkspace2, useAppContext } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSwr } from 'test-utils';
import { mockWardViewContext } from '../../mock';
import { type WardViewContext } from '../types';
import AdmissionRequestsBar from './admission-requests-bar.component';

vi.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);
const mockLaunchWorkspace = vi.mocked(launchWorkspace2);
describe('Admission Requests Button', () => {
  it('should launch workspace when clicked on manage button', async () => {
    const user = userEvent.setup();
    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={[]} />);

    await user.click(screen.getByRole('button', { name: /manage/i }));
    expect(mockLaunchWorkspace).toHaveBeenCalled();
  });

  it('should have one admission request', () => {
    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={[<div key="dummy-patient">Dummy Patient</div>]} />);

    expect(screen.getByText('1 admission request')).toBeInTheDocument();
  });
});
