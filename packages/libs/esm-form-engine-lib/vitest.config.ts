import { defineWorkspaceVitestConfigWithSetup } from '../../tooling/configs/vitest-config';

// This library's tests are written against the local `@openmrs/esm-framework` stubs in
// packages/test-utils/stubs, so it opts in to the framework stub aliases. Other workspace
// libs and apps use the real framework / mock and must not enable this.
export default defineWorkspaceVitestConfigWithSetup({}, { frameworkStubs: true });
