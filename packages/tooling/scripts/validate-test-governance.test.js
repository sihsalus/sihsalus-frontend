const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  collectWorkspaces,
  getPassWithNoTestsScripts,
  isTestFile,
  maximumExceptionDays,
  parseArguments,
  validateTestGovernance,
} = require('./validate-test-governance');

const repositoryRoot = path.resolve(__dirname, '../../..');
const validatorPath = path.join(repositoryRoot, 'packages/tooling/scripts/validate-test-governance.js');
const validationDate = '2026-09-03';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeException(overrides = {}) {
  return {
    workspace: '@sihsalus/legacy-app',
    path: 'packages/apps/legacy-app',
    owner: 'sihsalus@pucp.edu.pe',
    risk: 'high',
    priority: 'P0',
    missing: ['test-files'],
    reason: 'El flujo heredado necesita una regresión automatizada antes de retirar esta excepción.',
    expiresOn: '2026-10-31',
    ...overrides,
  };
}

function createFixture(t, { workspaces, exceptions = [], recordedOn = validationDate } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-governance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeJson(path.join(root, 'package.json'), {
    private: true,
    workspaces: ['packages/apps/*'],
  });
  writeJson(path.join(root, 'config/test-governance.json'), {
    version: 1,
    recordedOn,
    exceptions,
  });

  for (const workspace of workspaces ?? []) {
    const workspaceDirectory = workspace.directory ?? workspace.name.split('/').at(-1);
    const workspacePath = workspace.path ?? `packages/apps/${workspaceDirectory}`;
    const scripts = { ...(workspace.scripts ?? {}) };
    if (workspace.testScript !== null) {
      scripts.test = workspace.testScript ?? 'vitest run';
    }
    writeJson(path.join(root, workspacePath, 'package.json'), {
      name: workspace.name,
      scripts,
    });
    if (workspace.testFile) {
      const testPath = path.join(root, workspacePath, workspace.testFile);
      fs.mkdirSync(path.dirname(testPath), { recursive: true });
      fs.writeFileSync(testPath, 'export {};\n');
    }
    if (workspace.generatedTestFile) {
      const testPath = path.join(root, workspacePath, workspace.generatedTestFile);
      fs.mkdirSync(path.dirname(testPath), { recursive: true });
      fs.writeFileSync(testPath, 'export {};\n');
    }
  }

  return root;
}

function validateFixture(root, options = {}) {
  return validateTestGovernance({ repositoryRoot: root, today: validationDate, ...options });
}

test('keeps the repository test-debt baseline internally consistent', () => {
  const result = validateTestGovernance({ repositoryRoot, today: validationDate });
  const workspaces = collectWorkspaces(repositoryRoot);
  const config = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'config/test-governance.json'), 'utf8'));
  const gaps = workspaces.filter((workspace) => workspace.missing.length > 0).map((workspace) => workspace.name);
  const suppressions = workspaces.filter((workspace) => workspace.passWithNoTestsScripts.length > 0);

  assert.deepEqual(result.failures, []);
  assert.equal(result.summary.workspaceCount, workspaces.length);
  assert.equal(result.summary.gapCount, gaps.length);
  assert.equal(result.summary.exceptionCount, config.exceptions.length);
  assert.equal(result.summary.passWithNoTestsCount, suppressions.length);
  assert.deepEqual(
    gaps,
    config.exceptions.map((exception) => exception.workspace),
  );
});

test('accepts tested workspaces and a complete time-bounded legacy exception', (t) => {
  const root = createFixture(t, {
    workspaces: [
      { name: '@sihsalus/tested-app', testFile: 'src/example.test.ts' },
      { name: '@sihsalus/legacy-app', testScript: 'vitest run --passWithNoTests' },
    ],
    exceptions: [makeException()],
  });

  assert.deepEqual(validateFixture(root).failures, []);
});

test('rejects a workspace without discoverable tests when it is not documented', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/new-app' }],
  });

  assert.ok(
    validateFixture(root).failures.some((failure) =>
      failure.includes('@sihsalus/new-app (packages/apps/new-app) is missing test-files'),
    ),
  );
});

test('fails closed when the workspace inventory is empty', (t) => {
  const root = createFixture(t, { workspaces: [] });

  assert.ok(validateFixture(root).failures.some((failure) => failure.includes('Workspace inventory is empty')));
});

test('reports a malformed governance document without crashing', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/tested-app', testFile: 'src/example.test.ts' }],
  });
  writeJson(path.join(root, 'config/test-governance.json'), []);

  assert.deepEqual(validateFixture(root).failures, ['config/test-governance.json must contain a JSON object.']);
});

test('rejects a stale exception as soon as its workspace gains a test', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app', testFile: 'src/example.spec.tsx' }],
    exceptions: [makeException()],
  });

  assert.ok(
    validateFixture(root).failures.some((failure) => failure.includes('remove its stale governance exception')),
  );
});

test('tracks a missing test script independently from missing test files', (t) => {
  const exception = makeException({ missing: ['test-script', 'test-files'] });
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app', testScript: null }],
    exceptions: [exception],
  });

  assert.deepEqual(validateFixture(root).failures, []);

  exception.missing = ['test-files'];
  writeJson(path.join(root, 'config/test-governance.json'), {
    version: 1,
    recordedOn: validationDate,
    exceptions: [exception],
  });
  assert.ok(
    validateFixture(root).failures.some((failure) => failure.includes('currently misses [test-script, test-files]')),
  );
});

test('requires accountable, specific, and time-bounded exception metadata', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app' }],
    exceptions: [
      makeException({
        owner: 'unassigned',
        risk: 'critical',
        priority: 'later',
        reason: 'TODO',
        expiresOn: '2027-12-31',
        unsupported: true,
      }),
    ],
  });
  const failures = validateFixture(root).failures;

  assert.ok(failures.some((failure) => failure.includes('unsupported field(s): unsupported')));
  assert.ok(failures.some((failure) => failure.includes('owner must be a contact email or GitHub team')));
  assert.ok(failures.some((failure) => failure.includes('risk must be one of')));
  assert.ok(failures.some((failure) => failure.includes('priority must be one of')));
  assert.ok(failures.some((failure) => failure.includes('reason must be concrete')));
  assert.ok(failures.some((failure) => failure.includes(`${maximumExceptionDays}-day maximum`)));
});

test('fails an expired exception on the day after its deadline', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app' }],
    exceptions: [makeException({ expiresOn: '2026-09-02' })],
  });

  assert.ok(validateFixture(root).failures.some((failure) => failure.includes('expired on 2026-09-02')));
});

test('recognizes Vitest naming conventions but ignores arbitrary and generated sources', (t) => {
  assert.equal(isTestFile('src/example.test.tsx'), true);
  assert.equal(isTestFile('src/__tests__/contract.test.ts'), true);
  assert.equal(isTestFile('src/__tests__/contract.ts'), false);
  assert.equal(isTestFile('src/example.ts'), false);

  const root = createFixture(t, {
    workspaces: [
      {
        name: '@sihsalus/tested-app',
        testFile: 'src/__tests__/contract.test.ts',
        generatedTestFile: 'dist/generated.test.js',
      },
    ],
  });
  assert.deepEqual(validateFixture(root).failures, []);

  fs.rmSync(path.join(root, 'packages/apps/tested-app/src'), { recursive: true });
  assert.ok(validateFixture(root).failures.some((failure) => failure.includes('is missing test-files')));
});

test('detects passWithNoTests in any package script', () => {
  assert.deepEqual(
    getPassWithNoTestsScripts({
      scripts: {
        test: 'vitest run',
        coverage: 'vitest run --coverage --passWithNoTests',
        smoke: 'vitest run --passWithNoTests=true',
      },
    }),
    ['coverage', 'smoke'],
  );
});

test('rejects a new passWithNoTests suppression compared with the Git base', (t) => {
  const root = createFixture(t, {
    workspaces: [
      {
        name: '@sihsalus/tested-app',
        testFile: 'src/example.test.ts',
        testScript: 'vitest run --passWithNoTests',
      },
    ],
  });
  const result = validateFixture(root, {
    baseRef: 'origin/main',
    readManifestAtRef: ({ relativePath }) => {
      if (relativePath === 'config/test-governance.json') {
        return { version: 1, recordedOn: validationDate, exceptions: [] };
      }
      return { name: '@sihsalus/tested-app', scripts: { test: 'vitest run' } };
    },
  });

  assert.ok(result.failures.some((failure) => failure.includes('adds --passWithNoTests to script "test"')));
});

test('allows a passWithNoTests suppression already present on the Git base', (t) => {
  const root = createFixture(t, {
    workspaces: [
      {
        name: '@sihsalus/tested-app',
        testFile: 'src/example.test.ts',
        testScript: 'vitest run --passWithNoTests',
      },
    ],
  });
  const result = validateFixture(root, {
    baseRef: 'origin/main',
    readManifestAtRef: ({ relativePath }) => {
      if (relativePath === 'config/test-governance.json') {
        return { version: 1, recordedOn: validationDate, exceptions: [] };
      }
      return { name: '@sihsalus/tested-app', scripts: { test: 'vitest run --passWithNoTests' } };
    },
  });

  assert.deepEqual(result.failures, []);
});

test('rejects new no-test exceptions after the governance baseline exists', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app', testScript: 'vitest run --passWithNoTests' }],
    exceptions: [makeException()],
  });
  const result = validateFixture(root, {
    baseRef: 'origin/main',
    readManifestAtRef: ({ relativePath }) => {
      if (relativePath === 'config/test-governance.json') {
        return { version: 1, recordedOn: validationDate, exceptions: [] };
      }
      return { name: '@sihsalus/legacy-app', scripts: { test: 'vitest run --passWithNoTests' } };
    },
  });

  assert.ok(result.failures.some((failure) => failure.includes('New no-test exception')));
});

test('allows the one-time bootstrap when the Git base has no governance config', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/legacy-app', testScript: 'vitest run --passWithNoTests' }],
    exceptions: [makeException()],
  });
  const result = validateFixture(root, {
    baseRef: 'origin/main',
    readManifestAtRef: ({ relativePath }) => {
      if (relativePath === 'config/test-governance.json') {
        return null;
      }
      return { name: '@sihsalus/legacy-app', scripts: { test: 'vitest run --passWithNoTests' } };
    },
  });

  assert.deepEqual(result.failures, []);
});

test('rejects unsafe Git refs and malformed CLI arguments', (t) => {
  const root = createFixture(t, {
    workspaces: [{ name: '@sihsalus/tested-app', testFile: 'src/example.test.ts' }],
  });

  assert.ok(
    validateFixture(root, { baseRef: '--exec=$(bad)' }).failures.some((failure) =>
      failure.includes('Invalid base ref'),
    ),
  );
  assert.deepEqual(parseArguments(['--base', 'origin/main']), { baseRef: 'origin/main' });
  assert.deepEqual(parseArguments(['--help']), { help: true });
  assert.throws(() => parseArguments(['--base']), /requires a Git ref/);
  assert.throws(() => parseArguments(['--unknown']), /Unknown argument/);
});

test('CLI reports help, validates the repository base, and fails malformed input', () => {
  const help = spawnSync(process.execPath, [validatorPath, '--help'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: yarn validate:test-governance/);

  const validation = spawnSync(process.execPath, [validatorPath, '--base', 'origin/main'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(validation.status, 0, validation.stderr);
  assert.match(validation.stdout, /Test governance OK/);

  const malformed = spawnSync(process.execPath, [validatorPath, '--unknown'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /Unknown argument/);

  const unsafeRef = spawnSync(process.execPath, [validatorPath, '--base', '--unsafe'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(unsafeRef.status, 1);
  assert.match(unsafeRef.stderr, /Invalid base ref/);
});

test('wires the governance validator into the root command and CI base comparison', () => {
  const rootManifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');

  assert.equal(
    rootManifest.scripts['validate:test-governance'],
    'node packages/tooling/scripts/validate-test-governance.js',
  );
  assert.match(workflow, /yarn validate:test-governance --base "origin\/\$\{\{ github\.base_ref \}\}"/);
  assert.match(workflow, /yarn validate:test-governance --base "\$\{\{ github\.event\.before \}\}"/);
});
