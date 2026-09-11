import { beforeEach, expect, it, vi } from 'vitest';
import globalSetup from '../laboratory/core/global-setup';
import { loginToOpenmrsAndWriteStorageState } from './e2e-api';
import { loadE2EBaseConfig } from './e2e-gate-config';
import { validateE2ELaboratoryRemotePreflight } from './e2e-remote-preflight';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('./e2e-api', () => ({ loginToOpenmrsAndWriteStorageState: vi.fn() }));
vi.mock('./e2e-gate-config', () => ({ loadE2EBaseConfig: vi.fn() }));
vi.mock('./e2e-remote-preflight', () => ({
  validateE2ELaboratoryRemotePreflight: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadE2EBaseConfig).mockReturnValue({
    target: 'DEV',
    apiBaseUrl: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
    spaBaseUrl: 'http://127.0.0.1:8080/openmrs/spa',
    locationUuid: '33333333-3333-4333-8333-333333333333',
  });
});

it('fails global setup before login or browser fixtures when laboratory metadata is unavailable', async () => {
  vi.mocked(validateE2ELaboratoryRemotePreflight).mockRejectedValue(new Error('LABORATORY_CONCEPT_HTTP_404'));

  await expect(globalSetup()).rejects.toThrow('LABORATORY_CONCEPT_HTTP_404');

  expect(validateE2ELaboratoryRemotePreflight).toHaveBeenCalledWith(loadE2EBaseConfig());
  expect(loginToOpenmrsAndWriteStorageState).not.toHaveBeenCalled();
});

it('waits for the complete metadata preflight before writing authentication state', async () => {
  let completePreflight!: () => void;
  vi.mocked(validateE2ELaboratoryRemotePreflight).mockReturnValue(
    new Promise<void>((resolve) => {
      completePreflight = resolve;
    }),
  );

  const setup = globalSetup();
  expect(loginToOpenmrsAndWriteStorageState).not.toHaveBeenCalled();
  completePreflight();
  await setup;

  expect(loginToOpenmrsAndWriteStorageState).toHaveBeenCalledOnce();
  expect(loginToOpenmrsAndWriteStorageState).toHaveBeenCalledWith({
    locale: 'en',
    storageStatePath: expect.stringMatching(/\/e2e\/laboratory\/storageState\.json$/),
  });
});
