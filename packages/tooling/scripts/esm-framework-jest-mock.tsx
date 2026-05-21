/**
 * Framework test mock for @openmrs/esm-framework.
 *
 * Re-exports the upstream framework mock and supplements symbols that are
 * referenced by newer @openmrs/esm-patient-common-lib APIs but missing from
 * the framework version pinned in this repo.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const upstreamMockPath = require.resolve(
  path.join(path.dirname(require.resolve('@openmrs/esm-framework/package.json')), 'mock-vitest.tsx'),
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const frameworkMock = require(upstreamMockPath);

// Treat every workspace name as workspace2-registered so that
// `launchPatientWorkspace` delegates to `launchWorkspace2` in tests.
const alwaysRegistered: Array<string> = [] as Array<string>;
(alwaysRegistered as unknown as { includes: (name: string) => boolean }).includes = () => true;

module.exports = {
  ...frameworkMock,
  getRegisteredWorkspace2Names: vi?.fn ? vi.fn(() => alwaysRegistered) : () => alwaysRegistered,
};
