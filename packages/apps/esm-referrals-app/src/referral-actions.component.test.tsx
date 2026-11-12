import { navigate, showModal, showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ReferralActions from './referral-actions.component';
import ReferralReasonsModal from './referral-reasons.modal';
import { processCommunityReferral } from './referrals.resource';

vi.mock('./referrals.resource', () => ({ processCommunityReferral: vi.fn() }));

const referral = { messageId: 27, category: 'Synthetic service', clinicalNote: 'Synthetic referral reason' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(processCommunityReferral).mockReset();
});

it('opens reasons for the selected referral and disposes the modal on close', () => {
  const dispose = vi.fn();
  vi.mocked(showModal).mockReturnValue(dispose);
  render(<ReferralActions referralData={referral} status="active" />);
  fireEvent.click(screen.getByRole('button', { name: 'View reasons' }));
  expect(showModal).toHaveBeenCalledWith(
    'referral-reasons-dialog',
    expect.objectContaining({
      referralReasons: referral,
      status: 'active',
    }),
  );
  (vi.mocked(showModal).mock.calls[0][1].closeModal as () => void)();
  expect(dispose).toHaveBeenCalledOnce();
  expect(processCommunityReferral).not.toHaveBeenCalled();
});

it('navigates to the patient returned after successful processing, not the referral id', async () => {
  vi.mocked(processCommunityReferral).mockResolvedValue({ data: { uuid: 'synthetic-patient' } } as never);
  render(<ReferralActions referralData={referral} status="active" />);
  fireEvent.click(screen.getByRole('button', { name: 'Serve client' }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: '/openmrs/spa/patient/synthetic-patient/chart/Patient Summary',
    }),
  );
  expect(processCommunityReferral).toHaveBeenCalledExactlyOnceWith(27);
  expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
});

it('does not navigate or announce registration success when processing fails', async () => {
  vi.mocked(processCommunityReferral).mockRejectedValue(new Error('Synthetic processing failure'));
  render(<ReferralActions referralData={referral} status="active" />);
  fireEvent.click(screen.getByRole('button', { name: 'Serve client' }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(navigate).not.toHaveBeenCalled();
  expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
});

it('keeps completed referrals read-only in both the action list and the reasons modal', () => {
  const process = vi.fn();
  const close = vi.fn();
  render(
    <>
      <ReferralActions referralData={referral} status="completed" />
      <ReferralReasonsModal
        referralReasons={referral}
        status="completed"
        closeModal={close}
        handleProcessReferral={process}
      />
    </>,
  );
  expect(screen.getByRole('button', { name: 'View reasons' })).toBeInTheDocument();
  expect(screen.getByText('Synthetic referral reason')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Serve client' })).not.toBeInTheDocument();
  expect(process).not.toHaveBeenCalled();
});
