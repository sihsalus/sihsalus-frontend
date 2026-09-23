import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadOnlyClinicalSummary from './read-only-clinical-summary.component';

const defaultProps = { clinicalContext: {}, isLoading: false, isValidating: false };
const emptyMessage = 'No additional information to display in this summary.';

function getSummaryToggle() {
  return screen.getByRole('button', { name: /clinical summary/i });
}

test('starts collapsed and supports keyboard review without submitting the visit note', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <ReadOnlyClinicalSummary {...defaultProps} clinicalContext={{ chiefComplaint: 'Synthetic complaint' }} />
    </form>,
  );

  const toggle = getSummaryToggle();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.tab();
  expect(toggle).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Synthetic complaint')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('shows recorded fields as text and omits blank fields and empty sections', async () => {
  const user = userEvent.setup();
  render(
    <ReadOnlyClinicalSummary
      {...defaultProps}
      clinicalContext={{
        chiefComplaint: '  Synthetic complaint  ',
        illnessDuration: '0',
        biologicalFunctions: 'First line\nSecond line',
        auxiliaryExams: '   ',
        prescriptions: '\n',
      }}
    />,
  );
  await user.click(getSummaryToggle());

  expect(screen.getByText('Synthetic complaint')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getByText('First line Second line').textContent).toBe('First line\nSecond line');
  expect(screen.getAllByRole('term')).toHaveLength(3);
  expect(screen.getAllByRole('definition')).toHaveLength(3);
  expect(screen.queryByText('Treatment plan')).not.toBeInTheDocument();
  expect(screen.queryByText('Orders and continuity of care')).not.toBeInTheDocument();
  expect(screen.queryByText('Not recorded')).not.toBeInTheDocument();
  expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('does not expose SOAP sections in the outpatient summary', async () => {
  const user = userEvent.setup();
  render(<ReadOnlyClinicalSummary {...defaultProps} />);
  await user.click(getSummaryToggle());

  expect(screen.queryByText('SOAP assessment')).not.toBeInTheDocument();
  expect(screen.queryByText('Subjective')).not.toBeInTheDocument();
  expect(screen.queryByText('Objective / physical exam')).not.toBeInTheDocument();
  expect(screen.queryByText('Assessment')).not.toBeInTheDocument();
  expect(screen.queryByText('Treatment plan')).not.toBeInTheDocument();
  expect(screen.queryByText(/Synthetic/)).not.toBeInTheDocument();
  expect(screen.queryByRole('term')).not.toBeInTheDocument();
  expect(screen.getByText(emptyMessage)).toBeInTheDocument();
});

test('replaces the repeated empty fields with one empty message', async () => {
  const user = userEvent.setup();
  render(<ReadOnlyClinicalSummary {...defaultProps} clinicalContext={{ chiefComplaint: ' \n ' }} />);
  await user.click(getSummaryToggle());

  expect(screen.getAllByText(emptyMessage)).toHaveLength(1);
  expect(screen.queryByRole('term')).not.toBeInTheDocument();
  expect(screen.queryByText('SOAP assessment')).not.toBeInTheDocument();
  expect(screen.queryByText('Orders and continuity of care')).not.toBeInTheDocument();
  expect(screen.queryByText('Not recorded')).not.toBeInTheDocument();
});

test.each([
  { isLoading: true, isValidating: false },
  { isLoading: false, isValidating: true },
])('keeps the loading state outside the collapsed details: %o', (loadingProps) => {
  render(<ReadOnlyClinicalSummary {...defaultProps} {...loadingProps} />);

  const toggle = getSummaryToggle();
  const details = document.getElementById(toggle.getAttribute('aria-controls'));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Loading the outpatient clinical summary...')).toBeInTheDocument();
  expect(within(details).queryByText('Loading the outpatient clinical summary...')).not.toBeInTheDocument();
  expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
});

test('keeps a safe load error outside the collapsed details and does not claim an empty visit', () => {
  render(<ReadOnlyClinicalSummary {...defaultProps} error={new Error('private technical detail')} />);

  const toggle = getSummaryToggle();
  const details = document.getElementById(toggle.getAttribute('aria-controls'));
  const errorMessage = 'The clinical summary could not be loaded';
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText(errorMessage)).toBeInTheDocument();
  expect(within(details).queryByText(errorMessage)).not.toBeInTheDocument();
  expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
  expect(screen.queryByText('private technical detail')).not.toBeInTheDocument();
});

test('preserves expanded records while refreshing and when refresh fails', async () => {
  const user = userEvent.setup();
  const props = { ...defaultProps, clinicalContext: { referral: 'Synthetic referral' } };
  const { rerender } = render(<ReadOnlyClinicalSummary {...props} />);
  await user.click(getSummaryToggle());

  rerender(<ReadOnlyClinicalSummary {...props} isValidating />);
  expect(getSummaryToggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Synthetic referral')).toBeInTheDocument();

  rerender(<ReadOnlyClinicalSummary {...props} error={new Error('refresh failed')} />);
  expect(getSummaryToggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Synthetic referral')).toBeInTheDocument();
  expect(screen.getByText('The clinical summary could not be loaded')).toBeInTheDocument();
});
