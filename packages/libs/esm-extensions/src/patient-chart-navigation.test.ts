import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Session, sessionStore } from '@openmrs/esm-api';
import { configInternalStore, type ExtensionSlotConfig, provide } from '@openmrs/esm-config';
import { isOnline } from '@openmrs/esm-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import frontendConfig from '../../../../config/frontend.json';
import { attach, detach, getAssignedExtensions, registerExtension, registerExtensionSlot } from './extensions';
import { type ExtensionRegistration, getExtensionInternalStore } from './store';

vi.mock('@openmrs/esm-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-utils')>()),
  isOnline: vi.fn(() => true),
}));

vi.mock('@openmrs/esm-globals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-globals')>()),
  subscribeConnectivityChanged: vi.fn(),
}));

const chartModule = '@sihsalus/esm-patient-chart-app';
const chartSlot = 'patient-chart-dashboard-slot';
const appointmentsId = 'patient-appointments-summary-dashboard';
const summaryId = 'charts-summary-dashboard';
const appsDirectory = resolve(__dirname, '../../../apps');
type ManifestExtension = ExtensionRegistration & { slot?: string; slots?: string[]; component: string };

// Read manifests as data: this contract must detect newly registered menu items
// without importing every clinical application or launching its components.
const chartExtensions: ManifestExtension[] = readdirSync(appsDirectory).flatMap((directory) => {
  const manifestPath = resolve(appsDirectory, directory, 'src/routes.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { extensions?: ManifestExtension[] };
  return (manifest.extensions ?? [])
    .filter(({ slot, slots }) => slot === chartSlot || slots?.includes(chartSlot))
    .map((extension) => ({ ...extension, moduleName: `@sihsalus/${directory}` }));
});

const chartConfig = frontendConfig[chartModule] as { extensionSlots?: Record<string, ExtensionSlotConfig> };
const slotConfig = chartConfig.extensionSlots?.[chartSlot] ?? {};
const configuredOrder = slotConfig.order ?? [];
const visibleExtensions = chartExtensions.filter(({ component }) => component !== 'hiddenDashboardMarker');
const names = () => getAssignedExtensions(chartSlot).map(({ id }) => id);

function setPrivileges(privileges: string[]) {
  // Minimal synthetic session; the real userHasAccess implementation checks
  // these privileges and roles. No backend session or patient data is used.
  sessionStore.setState({
    loaded: true,
    session: {
      sessionId: 'synthetic-navigation-session',
      authenticated: true,
      user: {
        uuid: 'synthetic-navigation-user',
        roles: [],
        privileges: privileges.map((name) => ({ name, display: name, uuid: `synthetic-${name}` })),
      },
    } as Session,
  });
}

function configure(config: ExtensionSlotConfig) {
  provide({ [chartModule]: { extensionSlots: { [chartSlot]: config } } }, 'synthetic-navigation-config');
}

beforeEach(() => {
  getExtensionInternalStore().setState({ extensions: {}, slots: {} });
  configInternalStore.setState({ providedConfigs: [] });
  vi.mocked(isOnline).mockReturnValue(true);
  window.offlineEnabled = true;
  setPrivileges(chartExtensions.flatMap(({ privileges }) => privileges ?? []));
  registerExtensionSlot(chartModule, chartSlot);
  // Reverse attachment order to ensure module discovery order is not the policy.
  for (const extension of [...chartExtensions].reverse()) {
    registerExtension({
      ...extension,
      load: async () => ({ bootstrap: vi.fn(), mount: vi.fn(), unmount: vi.fn() }),
    });
    attach(chartSlot, extension.name);
  }
  configure(slotConfig);
});

afterEach(() => {
  getExtensionInternalStore().setState({ extensions: {}, slots: {} });
  configInternalStore.setState({ providedConfigs: [] });
  sessionStore.setState({ loaded: false, session: null });
  window.offlineEnabled = false;
});

describe('SIH Salus patient chart navigation policy', () => {
  it('configures each visible registered item exactly once without changing visibility or routes', () => {
    expect(Object.keys(slotConfig)).toEqual(['order']);
    expect(new Set(configuredOrder).size).toBe(configuredOrder.length);
    expect([...configuredOrder].sort()).toEqual(visibleExtensions.map(({ name }) => name).sort());
  });

  it('places vitals after the summary and keeps appointments with the current-care entries', () => {
    expect(names().slice(0, 5)).toEqual([
      summaryId,
      'results-summary-dashboard',
      'consulta-externa-dashboard-link',
      appointmentsId,
      'encounters-summary-dashboard',
    ]);
    expect(names().slice(0, configuredOrder.length)).toEqual(configuredOrder);
    expect(configuredOrder.slice(-2)).toEqual([
      'billing-summary-dashboard-link',
      'offline-tools-patient-chart-actions-dashboard-link',
    ]);
  });

  it('preserves hidden routing markers and existing clinical folders', () => {
    const assigned = getAssignedExtensions(chartSlot);
    expect(assigned).toHaveLength(chartExtensions.length);
    for (const { name, meta } of chartExtensions) {
      expect(assigned.find(({ id }) => id === name)?.meta).toEqual(meta);
    }
    for (const { name } of chartExtensions.filter(({ component }) => component === 'hiddenDashboardMarker')) {
      expect(configuredOrder).not.toContain(name);
      expect(names()).toContain(name);
    }
  });

  it('does not attach optional modules or recreate explicitly removed entries', () => {
    detach(chartSlot, appointmentsId);
    expect(names()).not.toContain(appointmentsId);
    configure({ ...slotConfig, remove: [summaryId] });
    expect(names()).not.toContain(summaryId);
  });

  it('keeps unlisted extensions after the configured entries and supports an implementer override', () => {
    const extraId = 'synthetic-extra-dashboard';
    registerExtension({ name: extraId, moduleName: 'synthetic-module', meta: {}, order: 0, load: vi.fn() });
    attach(chartSlot, extraId);
    expect(names().indexOf(extraId)).toBeGreaterThanOrEqual(configuredOrder.length);
    configure({ order: [appointmentsId, summaryId] });
    expect(names().slice(0, 2)).toEqual([appointmentsId, summaryId]);
    expect(names()).toContain(extraId);
  });

  it('does not grant appointments access to a user with only its edit privilege', () => {
    setPrivileges(['app:hoja.clinica.resumen', 'app:hoja.clinica.citas.editar']);
    expect(names()).toEqual([summaryId]);
    setPrivileges(['app:hoja.clinica.resumen', 'app:hoja.clinica.citas']);
    expect(names()).toEqual([summaryId, appointmentsId]);
    sessionStore.setState({ loaded: false, session: null });
    expect(names()).toEqual([]);
  });

  it('retains offline visibility instead of revealing online-only appointments', () => {
    vi.mocked(isOnline).mockReturnValue(false);
    expect(names()).toContain(summaryId);
    expect(names()).toContain('offline-tools-patient-chart-actions-dashboard-link');
    expect(names()).not.toContain(appointmentsId);
  });
});
