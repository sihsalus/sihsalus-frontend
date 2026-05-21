import path from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import aliasPresets from './alias-presets.json';
import sharedTestAliases from './shared-test-aliases.json';
import { createVitestAliases } from './vitest-aliases';

const packagesRoot = path.resolve(__dirname, '../..');
const sharedSetupFile = path.resolve(__dirname, '../scripts/setup-tests.ts');
const sharedWorkspaceTestAliases = Object.fromEntries(
  Object.entries(sharedTestAliases).map(([key, value]) => [key, `./${value}`]),
);
const sharedAppTestAliases = Object.fromEntries(
  Object.entries(sharedTestAliases).map(([key, value]) => [key, `../../${value}`]),
);
const appBaseAliases = {
  '@openmrs/esm-framework': '@openmrs/esm-framework/mock',
  '@openmrs/esm-translations': '@openmrs/esm-translations/mock',
  'test-utils': '../../test-utils/index.tsx',
  'test-utils/*': '../../test-utils/*',
};
function normalizeWorkspaceSetupFiles(setupFiles) {
  if (setupFiles === undefined) {
    return ['./setup-tests.ts'];
  }
  return Array.isArray(setupFiles) ? ['./setup-tests.ts', ...setupFiles] : ['./setup-tests.ts', setupFiles];
}
function normalizeAppSetupFiles(setupFiles) {
  if (setupFiles === undefined) {
    return [sharedSetupFile];
  }
  return Array.isArray(setupFiles) ? [sharedSetupFile, ...setupFiles] : [sharedSetupFile, setupFiles];
}
const plainScssPlugin = {
  name: 'identity-plain-scss',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.scss') && !id.endsWith('.css')) return null;
    if (id.endsWith('.module.scss') || id.endsWith('.module.css')) return null;
    return `
      const styles = new Proxy({}, {
        get: (_target, property) => typeof property === 'string' ? property : '',
      });
      export default styles;
    `;
  },
};
export function defineWorkspaceVitestConfig(config = {}) {
  return defineConfig(
    mergeConfig(
      {
        plugins: [plainScssPlugin],
        resolve: {
          alias: createVitestAliases(packagesRoot, sharedWorkspaceTestAliases),
        },
        test: {
          environment: 'happy-dom',
          clearMocks: true,
          globals: true,
          css: {
            modules: {
              classNameStrategy: 'non-scoped',
            },
          },
        },
      },
      config,
    ),
  );
}
export { aliasPresets };
export function defineAppVitestConfig(rootDir, options = {}) {
  const { aliases = {}, extraAliases = [], test = {} } = options;
  const { setupFiles, ...restTest } = test;
  return defineWorkspaceVitestConfig({
    resolve: {
      alias: [
        ...extraAliases,
        ...createVitestAliases(rootDir, {
          ...sharedAppTestAliases,
          ...appBaseAliases,
          ...aliases,
        }),
      ],
    },
    test: {
      ...restTest,
      setupFiles: normalizeAppSetupFiles(setupFiles),
    },
  });
}
export function defineWorkspaceVitestConfigWithSetup(config = {}) {
  const { test = {}, ...rest } = config;
  const { setupFiles, ...restTest } = test;
  return defineWorkspaceVitestConfig({
    ...rest,
    test: {
      ...restTest,
      setupFiles: normalizeWorkspaceSetupFiles(setupFiles),
    },
  });
}
//# sourceMappingURL=vitest-config.js.map
