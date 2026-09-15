import { showSnackbar } from '@openmrs/esm-framework';
import { getCurrentOfflineMode, setCurrentOfflineMode } from '@openmrs/esm-framework/src/internal';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import OfflineActionsModeButton from './offline-actions-mode-button.extension';

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  getCurrentOfflineMode: vi.fn(),
  setCurrentOfflineMode: vi.fn(),
}));

const getMode = vi.mocked(getCurrentOfflineMode);
const setMode = vi.mocked(setCurrentOfflineMode);
const snackbar = vi.mocked(showSnackbar);
let currentMode: ReturnType<typeof getCurrentOfflineMode>;

beforeEach(() => {
  currentMode = { current: 'off', active: false, notAvailable: false };
  getMode.mockReset().mockImplementation(() => currentMode);
  setMode.mockReset().mockImplementation((mode) => {
    currentMode = { current: mode, active: mode === 'on', notAvailable: mode === 'unavailable' };
  });
  snackbar.mockReset();
});

it('uses one clickable label and one switch without a surrounding link', async () => {
  const user = userEvent.setup();
  render(
    <ul>
      <OfflineActionsModeButton />
    </ul>,
  );
  const control = screen.getByRole('switch', { name: 'Enable offline use' });

  expect(screen.getAllByText('Enable offline use')).toHaveLength(1);
  expect(control.closest('a')).toBeNull();
  expect(control).not.toBeChecked();

  await user.click(screen.getByText('Enable offline use'));

  expect(control).toBeChecked();
  expect(control).toHaveFocus();
  expect(setMode).toHaveBeenCalledExactlyOnceWith('on');
});

it('persists each keyboard change once in StrictMode', async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <ul>
        <OfflineActionsModeButton />
      </ul>
    </StrictMode>,
  );
  const control = screen.getByRole('switch', { name: 'Enable offline use' });
  await user.tab();
  expect(control).toHaveFocus();

  await user.keyboard(' ');
  expect(control).toBeChecked();
  await user.keyboard('{Enter}');

  expect(control).not.toBeChecked();
  expect(setMode.mock.calls).toEqual([['on'], ['off']]);
});

it('keeps separate labels and IDs when more than one menu is mounted', () => {
  render(
    <ul>
      <OfflineActionsModeButton />
      <OfflineActionsModeButton />
    </ul>,
  );
  const controls = screen.getAllByRole('switch', { name: 'Enable offline use' });
  expect(controls[0].id).not.toBe(controls[1].id);
  for (const control of controls) {
    const label = document.getElementById(control.getAttribute('aria-labelledby'));
    expect(label).toHaveAttribute('for', control.id);
  }
});

it('retains the actual mode and explains when offline use is unavailable', async () => {
  currentMode = { current: 'unavailable', active: false, notAvailable: true };
  const user = userEvent.setup();
  render(
    <ul>
      <OfflineActionsModeButton />
    </ul>,
  );

  await user.click(screen.getByRole('switch', { name: 'Enable offline use' }));

  expect(screen.getByRole('switch')).not.toBeChecked();
  expect(setMode).not.toHaveBeenCalled();
  expect(snackbar).toHaveBeenCalledWith({
    kind: 'error',
    title: 'Offline use is not available in this session.',
  });
});

it('keeps the saved state after a storage error, hides technical detail and allows retry', async () => {
  const user = userEvent.setup();
  setMode.mockImplementationOnce(() => {
    throw new Error('private storage detail');
  });
  render(
    <ul>
      <OfflineActionsModeButton />
    </ul>,
  );
  const control = screen.getByRole('switch', { name: 'Enable offline use' });

  await user.click(control);

  expect(control).not.toBeChecked();
  expect(snackbar).toHaveBeenCalledWith({
    kind: 'error',
    title: 'Could not change offline use. Please try again.',
  });
  expect(JSON.stringify(snackbar.mock.calls)).not.toContain('private storage detail');

  await user.click(control);
  expect(control).toBeChecked();
});

it('renders an existing enabled preference and can turn it off', async () => {
  currentMode = { current: 'on', active: true, notAvailable: false };
  const user = userEvent.setup();
  render(
    <ul>
      <OfflineActionsModeButton />
    </ul>,
  );
  const control = screen.getByRole('switch', { name: 'Enable offline use' });
  expect(control).toBeChecked();

  await user.click(control);
  expect(control).not.toBeChecked();
  expect(setMode).toHaveBeenCalledExactlyOnceWith('off');
});
