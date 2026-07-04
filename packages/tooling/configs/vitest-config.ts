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

const workspaceBaseAliases: Record<string, string> = {
  '@openmrs/esm-framework/src/internal': './test-utils/stubs/esm-framework-internal.mock.tsx',
  '@openmrs/esm-framework': './test-utils/stubs/esm-framework.mock.tsx',
};

const appBaseAliases: Record<string, string> = {
  '@openmrs/esm-framework': '@openmrs/esm-framework/mock',
  '@openmrs/esm-translations': '@openmrs/esm-translations/mock',
  'test-utils': '../../test-utils/index.tsx',
  'test-utils/*': '../../test-utils/*',
};

type TestOptions = {
  setupFiles?: string | string[];
  [key: string]: unknown;
};

type AliasMap = Record<string, string>;
type VitestConfigLike = {
  resolve?: {
    alias?: Array<{ find: RegExp; replacement: string }>;
  };
  test?: TestOptions;
  [key: string]: unknown;
};

function normalizeWorkspaceSetupFiles(setupFiles?: TestOptions['setupFiles']) {
  if (setupFiles === undefined) {
    return ['./setup-tests.ts'];
  }
  return Array.isArray(setupFiles) ? ['./setup-tests.ts', ...setupFiles] : ['./setup-tests.ts', setupFiles];
}

function normalizeAppSetupFiles(setupFiles?: TestOptions['setupFiles']) {
  if (setupFiles === undefined) {
    return [sharedSetupFile];
  }
  return Array.isArray(setupFiles) ? [sharedSetupFile, ...setupFiles] : [sharedSetupFile, setupFiles];
}

const plainScssPlugin = {
  name: 'identity-plain-scss',
  enforce: 'pre' as const,
  load(id: string) {
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

function defineBaseVitestConfig(baseAliases: AliasMap, config: VitestConfigLike = {}) {
  return defineConfig(
    mergeConfig(
      {
        plugins: [plainScssPlugin],
        resolve: {
          alias: createVitestAliases(packagesRoot, {
            ...sharedWorkspaceTestAliases,
            ...baseAliases,
          }),
        },
        test: {
          environment: 'happy-dom',
          clearMocks: true,
          globals: true,
          reporters: ['dot'],
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

type WorkspaceVitestOptions = {
  // Opt in to resolving `@openmrs/esm-framework` and its `/src/internal` entrypoint to
  // the local stubs in `test-utils/stubs`. This is only appropriate for libraries whose
  // tests are written against those stubs (e.g. esm-form-engine-lib). Most workspace libs
  // and every app rely on the real `@openmrs/esm-framework` package / `/mock` and its
  // internal stores, so the stubs are OFF by default to avoid shadowing exports the real
  // module provides (parseDate, createUseStore, useStoreWithActions, ...).
  frameworkStubs?: boolean;
};

export function defineWorkspaceVitestConfig(config: VitestConfigLike = {}, options: WorkspaceVitestOptions = {}) {
  return defineBaseVitestConfig(options.frameworkStubs ? workspaceBaseAliases : {}, config);
}

export { aliasPresets };

export function defineAppVitestConfig(
  rootDir: string,
  options: {
    aliases?: AliasMap;
    extraAliases?: Array<{ find: RegExp; replacement: string }>;
    test?: VitestConfigLike['test'];
  } = {},
) {
  const { aliases = {}, extraAliases = [], test = {} } = options;
  const { setupFiles, ...restTest } = test;

  return defineBaseVitestConfig(
    {},
    {
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
    },
  );
}

export function defineWorkspaceVitestConfigWithSetup(
  config: VitestConfigLike = {},
  options: WorkspaceVitestOptions = {},
) {
  const { test = {}, ...rest } = config;
  const { setupFiles, ...restTest } = test as TestOptions;
  return defineWorkspaceVitestConfig(
    {
      ...rest,
      test: {
        ...restTest,
        setupFiles: normalizeWorkspaceSetupFiles(setupFiles),
      },
    },
    options,
  );
}
