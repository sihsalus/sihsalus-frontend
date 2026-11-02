import { ExtensionSlot, openmrsFetch } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen } from '@testing-library/react';

import FacilityReferralWorkspace from './facility-referral.workspace';

it('keeps submission disabled even after choosing a patient while interoperability is unavailable', () => {
  const closeWorkspace = vi.fn();
  vi.mocked(ExtensionSlot).mockClear();
  vi.mocked(openmrsFetch).mockClear();
  render(<FacilityReferralWorkspace closeWorkspace={closeWorkspace} />);

  expect(screen.getByText('Backend pending')).toBeInTheDocument();
  const searchProps = vi.mocked(ExtensionSlot).mock.calls.find(([props]) => props.name === 'patient-search-bar-slot')?.[0];
  expect(searchProps).toBeDefined();
  const selectPatient = searchProps.state.selectPatientAction as (patientUuid: string) => void;
  act(() => selectPatient('synthetic-patient'));
  expect(screen.getByText('synthetic-patient')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit referral' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit referral' }));
  expect(openmrsFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(closeWorkspace).toHaveBeenCalledOnce();
});
