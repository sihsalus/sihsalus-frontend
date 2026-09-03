const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');
const { spawnSync } = require('node:child_process');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const repositoryRoot = path.resolve(__dirname, '../../..');
const runnerPath = path.join(repositoryRoot, 'e2e/scripts/run-suite.mjs');

let catalog;
let runner;

before(async () => {
  runner = await import(pathToFileURL(runnerPath));
  catalog = await runner.loadSuiteCatalog();
});

function cloneCatalog() {
  return structuredClone(catalog);
}

function createChildProcess(closeCode = 0, signal = null) {
  const child = new EventEmitter();
  queueMicrotask(() => child.emit('close', closeCode, signal));
  return child;
}

test('catalogs all 12 Playwright suites with explicit execution metadata', () => {
  assert.deepEqual(
    catalog.suites.map(({ id }) => id),
    [
      'billing',
      'clinical',
      'cohort-builder',
      'dispensing',
      'dyaku',
      'fast-data-entry',
      'form-builder',
      'laboratory',
      'offline-laptop',
      'patient-imaging',
      'stock-management',
      'user-onboarding',
    ],
  );

  for (const suite of catalog.suites) {
    const expectedConfig = suite.id === 'clinical' ? 'playwright.config.ts' : `e2e/${suite.id}/playwright.config.ts`;
    const expectedSpecDir = suite.id === 'clinical' ? 'e2e/tests' : `e2e/${suite.id}/specs`;

    assert.equal(suite.config, expectedConfig, `${suite.id} debe conservar su configuración Playwright`);
    assert.equal(suite.specDir, expectedSpecDir, `${suite.id} debe conservar la propiedad de sus specs`);
    assert.equal(typeof suite.config, 'string');
    assert.equal(typeof suite.specDir, 'string');
    assert.match(suite.status, /^(quarantined|runnable)$/);
    assert.equal(typeof suite.gate, 'boolean');
    assert.equal(typeof suite.typecheck, 'boolean');
    assert.equal(typeof suite.ci, 'boolean');
    assert.ok(suite.reason.length >= 20);
    assert.doesNotMatch(suite.reason, /https?:\/\/|[\w.+-]+@[\w.-]+|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i);
  }
});

test('allows only the three explicitly approved suites', () => {
  const runnableSuites = catalog.suites.filter(({ status }) => status === 'runnable').map(({ id }) => id);
  assert.deepEqual(runnableSuites, ['clinical', 'laboratory', 'offline-laptop']);
  assert.deepEqual(runner.RUNNABLE_SUITE_IDS, runnableSuites);

  assert.equal(catalog.suites.find(({ id }) => id === 'clinical').ci, true);
  assert.equal(catalog.suites.find(({ id }) => id === 'laboratory').ci, true);
  assert.equal(catalog.suites.find(({ id }) => id === 'offline-laptop').ci, false);
});

test('records typecheck coverage consistently with e2e/tsconfig.json', async () => {
  const typecheckedSuites = catalog.suites.filter(({ typecheck }) => typecheck).map(({ id }) => id);
  assert.deepEqual(typecheckedSuites, [
    'clinical',
    'cohort-builder',
    'dyaku',
    'laboratory',
    'offline-laptop',
    'patient-imaging',
    'stock-management',
    'user-onboarding',
  ]);

  const tsconfig = JSON.parse(await readFile(path.join(repositoryRoot, 'e2e/tsconfig.json'), 'utf8'));
  for (const suite of catalog.suites) {
    const expectedInclude = suite.id === 'clinical' ? 'tests/**/*.ts' : `${suite.id}/**/*.ts`;
    assert.equal(
      tsconfig.include.includes(expectedInclude),
      suite.typecheck,
      `${suite.id} debe alinear typecheck con e2e/tsconfig.json`,
    );
  }
});

test('records browser CI coverage consistently with the central runner workflow', async () => {
  const workflow = await readFile(path.join(repositoryRoot, '.github/workflows/e2e.yml'), 'utf8');
  const suiteMatrix = workflow.match(/suite:\s*\[([^\]]+)]/);
  assert.ok(suiteMatrix, 'el workflow debe declarar una matriz de IDs de suite');
  const ciSuiteIds = suiteMatrix[1].split(',').map((suiteId) => suiteId.trim());

  assert.deepEqual(
    ciSuiteIds,
    catalog.suites.filter(({ ci }) => ci).map(({ id }) => id),
  );
  assert.match(workflow, /run: yarn test:e2e:suite \$\{\{ matrix\.suite }}/);
  assert.doesNotMatch(workflow, /matrix\.command/);
});

test('ignores modular authentication state and JUnit output paths without creating them', () => {
  for (const generatedPath of [
    'e2e/laboratory/storageState.json',
    'e2e/laboratory/storage-state.json',
    'e2e/laboratory/results.xml',
  ]) {
    const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', generatedPath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${generatedPath} debe estar cubierto por .gitignore`);
  }
});

test('owns every Playwright config and every spec exactly once', async () => {
  const coverage = await runner.validateCatalogCoverage(catalog, repositoryRoot);

  assert.equal(coverage.configFiles.length, 12);
  assert.equal(new Set(coverage.configFiles).size, coverage.configFiles.length);
  assert.ok(coverage.specFiles.length > 0);
  assert.equal(new Set(coverage.specFiles).size, coverage.specFiles.length);
  assert.equal(
    Object.values(coverage.specCounts).reduce((sum, count) => sum + count, 0),
    coverage.specFiles.length,
  );
  assert.ok(Object.values(coverage.specCounts).every((count) => count > 0));
});

test('rejects a config present in the repository but omitted from the catalog', async () => {
  const incompleteCatalog = cloneCatalog();
  incompleteCatalog.suites = incompleteCatalog.suites.filter(({ id }) => id !== 'billing');

  await assert.rejects(
    runner.validateCatalogCoverage(incompleteCatalog, repositoryRoot),
    /no está declarada en el catálogo E2E/,
  );
});

test('rejects overlapping spec ownership', async () => {
  const overlappingCatalog = cloneCatalog();
  overlappingCatalog.suites.find(({ id }) => id === 'billing').specDir = 'e2e';

  await assert.rejects(
    runner.validateCatalogCoverage(overlappingCatalog, repositoryRoot),
    /debe pertenecer exactamente a una suite catalogada/,
  );
});

test('validates duplicate IDs, paths, states, booleans and the runner allowlist', () => {
  const duplicateId = cloneCatalog();
  duplicateId.suites[1].id = duplicateId.suites[0].id;
  assert.throws(() => runner.validateSuiteCatalog(duplicateId), /ID de suite .* está duplicado/);

  const escapedPath = cloneCatalog();
  escapedPath.suites[0].config = '../playwright.config.ts';
  assert.throws(() => runner.validateSuiteCatalog(escapedPath), /config inválido/);

  const invalidState = cloneCatalog();
  invalidState.suites[0].status = 'experimental';
  assert.throws(() => runner.validateSuiteCatalog(invalidState), /estado no soportado/);

  const invalidBoolean = cloneCatalog();
  invalidBoolean.suites[0].typecheck = 'no';
  assert.throws(() => runner.validateSuiteCatalog(invalidBoolean), /typecheck como booleano/);

  const widenedAllowlist = cloneCatalog();
  Object.assign(widenedAllowlist.suites[0], { gate: true, status: 'runnable' });
  assert.throws(() => runner.validateSuiteCatalog(widenedAllowlist), /no coincide con la allowlist/);

  const runnableWithoutTypecheck = cloneCatalog();
  runnableWithoutTypecheck.suites.find(({ id }) => id === 'clinical').typecheck = false;
  assert.throws(() => runner.validateSuiteCatalog(runnableWithoutTypecheck), /debe estar incluida en typecheck E2E/);
});

test('selects runnable suites and forwards ordinary Playwright arguments unchanged', () => {
  const selection = runner.selectRunnableSuite(catalog, [
    'clinical',
    '--project=desktop',
    '--grep',
    'consulta; no es una orden de shell',
  ]);

  assert.equal(selection.suite.id, 'clinical');
  assert.deepEqual(selection.passthroughArgs, ['--project=desktop', '--grep', 'consulta; no es una orden de shell']);
});

test('fails closed for missing, unknown and quarantined suite IDs', () => {
  assert.throws(() => runner.selectRunnableSuite(catalog, []), /Uso: yarn test:e2e:suite/);
  assert.throws(() => runner.selectRunnableSuite(catalog, ['does-not-exist']), /Suite E2E desconocida/);
  assert.throws(() => runner.selectRunnableSuite(catalog, ['billing']), /está en cuarentena/);
});

test('rejects every Playwright config override form', () => {
  for (const overrideArgs of [
    ['clinical', '-c', 'e2e/billing/playwright.config.ts'],
    ['clinical', '-ce2e/billing/playwright.config.ts'],
    ['clinical', '--config', 'e2e/billing/playwright.config.ts'],
    ['clinical', '--config=e2e/billing/playwright.config.ts'],
  ]) {
    assert.throws(
      () => runner.selectRunnableSuite(catalog, overrideArgs),
      /No se permite reemplazar la configuración catalogada/,
    );
  }
});

test('spawns the Playwright CLI without a shell and keeps passthrough arguments literal', async () => {
  const suite = catalog.suites.find(({ id }) => id === 'clinical');
  const fakeEnvironment = { E2E_GATE_TARGET: 'DEV' };
  let receivedInvocation;

  const exitCode = await runner.executePlaywrightSuite(suite, ['--grep', 'consulta; echo ignored'], {
    cwd: '/synthetic/repository',
    env: fakeEnvironment,
    playwrightCli: '/synthetic/playwright-cli.js',
    spawnImplementation(command, args, options) {
      receivedInvocation = { command, args, options };
      return createChildProcess(0);
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(receivedInvocation.command, process.execPath);
  assert.deepEqual(receivedInvocation.args, [
    '/synthetic/playwright-cli.js',
    'test',
    '--config',
    'playwright.config.ts',
    '--grep',
    'consulta; echo ignored',
  ]);
  assert.equal(receivedInvocation.options.cwd, '/synthetic/repository');
  assert.equal(receivedInvocation.options.env, fakeEnvironment);
  assert.equal(receivedInvocation.options.shell, false);
  assert.equal(receivedInvocation.options.stdio, 'inherit');
});

test('propagates a nonzero Playwright status and converts termination by signal to failure', async () => {
  const suite = catalog.suites.find(({ id }) => id === 'laboratory');
  const dependencies = {
    playwrightCli: '/synthetic/playwright-cli.js',
    spawnImplementation: () => createChildProcess(17),
  };
  assert.equal(await runner.executePlaywrightSuite(suite, [], dependencies), 17);

  dependencies.spawnImplementation = () => createChildProcess(null, 'SIGTERM');
  assert.equal(await runner.executePlaywrightSuite(suite, [], dependencies), 1);
});

test('reports spawn failures without exposing the original process error', async () => {
  const suite = catalog.suites.find(({ id }) => id === 'offline-laptop');
  const spawnError = Object.assign(new Error('sensitive process detail'), { code: 'ENOENT' });
  const child = new EventEmitter();
  const execution = runner.executePlaywrightSuite(suite, [], {
    playwrightCli: '/synthetic/playwright-cli.js',
    spawnImplementation: () => {
      queueMicrotask(() => child.emit('error', spawnError));
      return child;
    },
  });

  await assert.rejects(execution, (error) => {
    assert.equal(error.message, 'No se pudo iniciar Playwright (ENOENT).');
    assert.doesNotMatch(error.message, /sensitive process detail/);
    return true;
  });
});

test('the CLI rejects quarantine before Playwright can start', () => {
  const result = spawnSync(process.execPath, [runnerPath, 'billing'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /billing está en cuarentena/);
  assert.doesNotMatch(result.stderr, /playwright-cli/);
});
