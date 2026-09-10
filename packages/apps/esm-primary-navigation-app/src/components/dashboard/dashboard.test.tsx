import { ComponentContext, getConfigStore, getExtensionsConfigStore } from '@openmrs/esm-framework/src/internal';
import { render, screen } from '@testing-library/react';
import Dashboard from './dashboard.component';

vi.mock('@openmrs/esm-framework/src/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openmrs/esm-framework/src/internal')>();
  return {
    ...actual,
    DashboardExtension: ({ title }: { title: string }) => <h1>{title}</h1>,
  };
});

beforeEach(() => {
  for (const moduleName of ['parent-module', 'slot-module', 'explicit-module']) {
    getConfigStore(moduleName).setState({
      loaded: true,
      config: { path: 'overview', title: moduleName, icon: '', moduleName },
    });
  }
  getExtensionsConfigStore().setState({ configs: {} });
});

it.each([
  undefined,
  'explicit-module',
])('loads a standalone dashboard from module configuration (override: %s)', async (moduleName) => {
  render(
    <ComponentContext.Provider value={{ moduleName: 'parent-module', featureName: 'standalone' }}>
      <Dashboard basePath="/home" moduleName={moduleName} />
    </ComponentContext.Provider>,
  );

  expect(await screen.findByRole('heading', { name: moduleName ?? 'parent-module' })).toBeInTheDocument();
});

it.each([
  undefined,
  'explicit-module',
])('preserves extension configuration on a dashboard (override: %s)', async (moduleName) => {
  getExtensionsConfigStore().setState({
    configs: {
      'dashboard-slot': {
        'dashboard-extension': {
          loaded: true,
          translationOverridesLoaded: true,
          config: { title: 'Configured extension dashboard' },
        },
      },
    },
  });
  render(
    <ComponentContext.Provider
      value={{
        moduleName: 'parent-module',
        featureName: 'extension',
        extension: {
          extensionSlotName: 'dashboard-slot',
          extensionSlotModuleName: 'slot-module',
          extensionId: 'dashboard-extension',
        },
      }}
    >
      <Dashboard basePath="/home" moduleName={moduleName} />
    </ComponentContext.Provider>,
  );

  expect(await screen.findByRole('heading', { name: 'Configured extension dashboard' })).toBeInTheDocument();
});
