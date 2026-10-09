import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TabbedDashboard, { type TabConfig } from './tabbed-dashboard.component';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  ExtensionSlot: ({ name }: { name: string }) => <div data-testid={name} />,
}));

const icon = () => null;
const patient: fhir.Patient = { resourceType: 'Patient', id: 'synthetic-a' };
const tabs: TabConfig[] = [
  { id: 'overview', labelKey: 'Overview', icon, content: <div>Overview reader</div> },
  { id: 'growth', labelKey: 'Growth', icon, content: <div>Growth reader</div> },
];
const props = { patient, patientUuid: patient.id ?? '', titleKey: 'CRED', ariaLabelKey: 'Care sections' };

it('mounts only the selected reader when requested and selects sections from the keyboard', async () => {
  const user = userEvent.setup();
  render(<TabbedDashboard {...props} tabs={tabs} mountActiveTabOnly />);
  expect(screen.getByText('Overview reader')).toBeVisible();
  expect(screen.queryByText('Growth reader')).not.toBeInTheDocument();
  screen.getByRole('tab', { name: 'Overview' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Growth' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Growth reader')).toBeVisible();
  expect(screen.queryByText('Overview reader')).not.toBeInTheDocument();
});

it('keeps mouse and keyboard selection in sync without skipping sections', async () => {
  const user = userEvent.setup();
  const history: TabConfig = { id: 'history', labelKey: 'History', icon, content: <div>History reader</div> };
  render(<TabbedDashboard {...props} tabs={[...tabs, history]} mountActiveTabOnly />);
  await user.click(screen.getByRole('tab', { name: 'Growth' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('History reader')).toBeVisible();
  expect(screen.queryByText('Growth reader')).not.toBeInTheDocument();

  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: 'Growth' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Growth reader')).toBeVisible();
  expect(screen.queryByText('History reader')).not.toBeInTheDocument();
});

it('keeps selection by stable ID after permitted tabs change, then resets for another patient', async () => {
  const user = userEvent.setup();
  const extra: TabConfig = { id: 'history', labelKey: 'History', icon, content: <div>History reader</div> };
  const { rerender } = render(<TabbedDashboard {...props} tabs={[tabs[0], extra, tabs[1]]} mountActiveTabOnly />);
  await user.click(screen.getByRole('tab', { name: 'Growth' }));
  rerender(<TabbedDashboard {...props} tabs={tabs} mountActiveTabOnly />);
  expect(screen.getByRole('tab', { name: 'Growth' })).toHaveAttribute('aria-selected', 'true');
  rerender(<TabbedDashboard {...props} patientUuid="synthetic-b" tabs={tabs} mountActiveTabOnly />);
  expect(screen.getByText('Overview reader')).toBeVisible();
  expect(screen.queryByText('Growth reader')).not.toBeInTheDocument();
});

it('falls back to the first permitted tab when the selected section is removed', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<TabbedDashboard {...props} tabs={tabs} mountActiveTabOnly />);
  await user.click(screen.getByRole('tab', { name: 'Growth' }));
  rerender(<TabbedDashboard {...props} tabs={[tabs[0]]} mountActiveTabOnly />);
  expect(screen.getByText('Overview reader')).toBeVisible();
  expect(screen.queryByText('Growth reader')).not.toBeInTheDocument();
});

it('preserves mounting of extension slots for existing consumers by default', () => {
  render(
    <TabbedDashboard
      {...props}
      tabs={[
        { labelKey: 'First', icon, slotName: 'first-slot' },
        { labelKey: 'Second', icon, slotName: 'second-slot' },
      ]}
    />,
  );
  expect(screen.getByTestId('first-slot')).toBeInTheDocument();
  expect(screen.getByTestId('second-slot')).toBeInTheDocument();
});
