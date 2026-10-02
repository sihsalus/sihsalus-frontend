import { getDefaultsFromConfigSchema, isDesktop, navigate, useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils';

import { configSchema } from '../config-schema';

import PatientSearchIconWrapper from './index';

// Keep the real router, launcher and search bar: an absent URL parameter is null,
// unlike the fixed string supplied by the launcher's isolated component tests.
beforeEach(() => {
  vi.stubGlobal('spaBase', '/openmrs/spa');
  vi.mocked(isDesktop).mockReturnValue(true);
  vi.mocked(useSession).mockReturnValue(mockSession.data);
  const config = getDefaultsFromConfigSchema(configSchema);
  config.search.showRecentlySearchedPatients = false;
  vi.mocked(useConfig).mockReturnValue(config);
});

afterEach(() => {
  window.history.replaceState({}, '', '/openmrs/spa/');
  vi.unstubAllGlobals();
});

it.each([
  ['/search', ''],
  ['/search?query=', ''],
  ['/search?query=Rosa%20Elena', 'Rosa Elena'],
  ['/home?query=unrelated', ''],
])('opens the header search from %s', async (route, initialValue) => {
  window.history.replaceState({}, '', `/openmrs/spa${route}`);
  const user = userEvent.setup();
  render(<PatientSearchIconWrapper />);

  await user.click(screen.getByRole('button', { name: 'Search patient' }));

  const searchbox = screen.getByRole('searchbox');
  expect(searchbox).toHaveValue(initialValue);
  expect(searchbox).toHaveFocus();
  const submit = screen.getByRole('button', { name: 'Search' });
  if (initialValue) expect(submit).toBeEnabled();
  else expect(submit).toBeDisabled();
  await user.clear(searchbox);
  await user.type(searchbox, 'Rosa Elena');
  await user.keyboard('{Enter}');

  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/search?query=Rosa%20Elena' });
});
