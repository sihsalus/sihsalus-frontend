import { useAssignedExtensions, useConfig, useSession } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSessionDataResponse } from '../../../test-utils/mocks/session-pc.mock';
import { DefaultDashboardRedirect } from './default-dashboard-redirect.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useAssignedExtensions: vi.fn(),
  useConfig: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('./dashboard-container/dashboard-not-found.component', () => ({
  DashboardNotFound: () => <h1>Dashboard not found</h1>,
}));

function CurrentPage() {
  const { pathname, search } = useLocation();
  return <h1>{pathname + search}</h1>;
}

function renderNavigation() {
  const previousPage = '/search?query=synthetic';
  const router = createMemoryRouter(
    [
      { path: '/home', element: <DefaultDashboardRedirect /> },
      { path: '*', element: <CurrentPage /> },
    ],
    { initialEntries: [previousPage, '/home'] },
  );
  render(<RouterProvider router={router} />);
  return { router, previousPage };
}

beforeEach(() => {
  vi.mocked(useAssignedExtensions).mockReturnValue(
    ['home', 'service-queues'].map((name) => ({
      id: `synthetic-${name}-extension`,
      name: `synthetic-${name}-extension`,
      moduleName: 'synthetic-dashboard-module',
      meta: { name, slot: `synthetic-${name}-slot`, title: name },
      config: null,
    })),
  );
  vi.mocked(useSession).mockReturnValue({
    ...mockSessionDataResponse.data,
    user: {
      ...mockSessionDataResponse.data.user,
      roles: [{ uuid: 'synthetic-role', display: 'Synthetic role', name: 'Synthetic role' }],
    },
  });
});

describe('default dashboard navigation history', () => {
  it.each([
    ['default dashboard', undefined, 'home'],
    ['dashboard assigned to the role', 'service-queues', 'service-queues'],
    ['fallback for an unavailable dashboard', 'missing-dashboard', 'home'],
  ])('returns to the previous page after visiting the %s', async (_scenario, configuredDashboard, expected) => {
    vi.mocked(useConfig).mockReturnValue({
      defaultDashboardPerRole: configuredDashboard ? { 'Synthetic role': configuredDashboard } : {},
    });
    const { router, previousPage } = renderNavigation();
    expect(await screen.findByRole('heading', { name: `/home/${expected}` })).toBeVisible();

    await act(async () => {
      await router.navigate('/appointments');
      await router.navigate(-1);
    });
    expect(await screen.findByRole('heading', { name: `/home/${expected}` })).toBeVisible();

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(screen.getByRole('heading', { name: previousPage })).toBeVisible());

    await act(async () => {
      await router.navigate(1);
    });
    expect(await screen.findByRole('heading', { name: `/home/${expected}` })).toBeVisible();
    await act(async () => {
      await router.navigate(1);
    });
    expect(await screen.findByRole('heading', { name: '/appointments' })).toBeVisible();
  });

  it('preserves the unavailable-dashboard page and lets the user go back', async () => {
    vi.mocked(useConfig).mockReturnValue({ defaultDashboardPerRole: {} });
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
    const { router, previousPage } = renderNavigation();
    expect(screen.getByRole('heading', { name: 'Dashboard not found' })).toBeVisible();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(await screen.findByRole('heading', { name: previousPage })).toBeVisible();
  });
});
