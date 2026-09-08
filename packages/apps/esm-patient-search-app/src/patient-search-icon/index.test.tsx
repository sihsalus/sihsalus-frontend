import { getDefaultsFromConfigSchema, navigate, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils';

import { configSchema } from '../config-schema';

import PatientSearchIconWrapper from './index';

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  vi.mocked(useSession).mockReturnValue({
    ...mockSession.data,
    user: {
      ...mockSession.data.user,
      roles: [],
      privileges: [
        { uuid: 'synthetic-chart-access', name: 'app:hoja.clinica', display: 'app:hoja.clinica', links: [] },
      ],
    },
  });
  vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
  vi.stubGlobal('spaBase', '/openmrs/spa');
});

it.each([
  'home',
  'search?query=synthetic',
  'recent-patients',
])('renders the real router wrapper at %s and navigates to the independent page', async (route) => {
  window.history.replaceState({}, '', `/openmrs/spa/${route}`);
  const user = userEvent.setup();
  render(<PatientSearchIconWrapper />);
  expect(screen.getByRole('button', { name: 'Search patient' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Recent patients' }));
  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/recent-patients' });
});

it('offers the same dedicated destination on tablet without opening a search overlay', async () => {
  vi.mocked(useLayoutType).mockReturnValue('tablet');
  window.history.replaceState({}, '', '/openmrs/spa/home');
  const user = userEvent.setup();
  render(<PatientSearchIconWrapper />);
  await user.click(screen.getByRole('button', { name: 'Recent patients' }));
  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/recent-patients' });
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});
