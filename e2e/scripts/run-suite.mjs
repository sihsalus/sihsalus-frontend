#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const SUITE_CATALOG_PATH = fileURLToPath(new URL('../suite-catalog.json', import.meta.url));
export const RUNNABLE_SUITE_IDS = Object.freeze(['clinical', 'laboratory', 'offline-laptop']);

const ROOT_KEYS = ['suites', 'version'];
const SUITE_KEYS = ['ci', 'config', 'gate', 'id', 'reason', 'specDir', 'status', 'typecheck'];
const SUITE_STATUSES = new Set(['quarantined', 'runnable']);
const RUNNABLE_SUITE_ID_SET = new Set(RUNNABLE_SUITE_IDS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expectedKeys, context) {
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(`${context} debe contener exactamente: ${expectedKeys.join(', ')}.`);
  }
}

function assertCatalogPath(value, field, suiteId) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split('/').includes('..')
  ) {
    throw new Error(`La suite ${suiteId} tiene ${field} inválido.`);
  }
}

export function validateSuiteCatalog(value) {
  if (!isRecord(value)) {
    throw new Error('El catálogo E2E debe ser un objeto JSON.');
  }

  assertExactKeys(value, ROOT_KEYS, 'El catálogo E2E');

  if (value.version !== 1) {
    throw new Error('La versión del catálogo E2E no está soportada.');
  }

  if (!Array.isArray(value.suites) || value.suites.length === 0) {
    throw new Error('El catálogo E2E debe declarar al menos una suite.');
  }

  const ids = new Set();
  const configs = new Set();
  const specDirs = new Set();

  for (const [index, suite] of value.suites.entries()) {
    if (!isRecord(suite)) {
      throw new Error(`La entrada ${index + 1} del catálogo E2E debe ser un objeto.`);
    }

    assertExactKeys(suite, SUITE_KEYS, `La entrada ${index + 1} del catálogo E2E`);

    if (typeof suite.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suite.id)) {
      throw new Error(`La entrada ${index + 1} tiene un ID de suite inválido.`);
    }

    if (ids.has(suite.id)) {
      throw new Error(`El ID de suite ${suite.id} está duplicado.`);
    }
    ids.add(suite.id);

    assertCatalogPath(suite.config, 'config', suite.id);
    assertCatalogPath(suite.specDir, 'specDir', suite.id);

    if (!suite.config.endsWith('playwright.config.ts')) {
      throw new Error(`La suite ${suite.id} debe apuntar a un playwright.config.ts.`);
    }

    if (suite.specDir !== 'e2e' && !suite.specDir.startsWith('e2e/')) {
      throw new Error(`La suite ${suite.id} debe mantener sus specs dentro de e2e/.`);
    }

    if (configs.has(suite.config)) {
      throw new Error(`La configuración ${suite.config} está duplicada en el catálogo E2E.`);
    }
    configs.add(suite.config);

    if (specDirs.has(suite.specDir)) {
      throw new Error(`El directorio ${suite.specDir} está duplicado en el catálogo E2E.`);
    }
    specDirs.add(suite.specDir);

    if (!SUITE_STATUSES.has(suite.status)) {
      throw new Error(`La suite ${suite.id} tiene un estado no soportado.`);
    }

    for (const field of ['gate', 'typecheck', 'ci']) {
      if (typeof suite[field] !== 'boolean') {
        throw new Error(`La suite ${suite.id} debe declarar ${field} como booleano.`);
      }
    }

    if (typeof suite.reason !== 'string' || suite.reason.length < 20 || /[\r\n]/.test(suite.reason)) {
      throw new Error(`La suite ${suite.id} debe declarar una razón segura y concreta.`);
    }

    const isRunnable = suite.status === 'runnable';
    if (suite.gate !== isRunnable) {
      throw new Error(`La suite ${suite.id} debe alinear gate con su estado runnable.`);
    }

    if (isRunnable !== RUNNABLE_SUITE_ID_SET.has(suite.id)) {
      throw new Error(`La suite ${suite.id} no coincide con la allowlist del runner.`);
    }

    if (isRunnable && !suite.typecheck) {
      throw new Error(`La suite runnable ${suite.id} debe estar incluida en typecheck E2E.`);
    }

    if (suite.ci && !suite.gate) {
      throw new Error(`La suite ${suite.id} no puede habilitar CI mientras esté en cuarentena.`);
    }
  }

  return value;
}

export async function loadSuiteCatalog(catalogPath = SUITE_CATALOG_PATH) {
  let source;
  try {
    source = await readFile(catalogPath, 'utf8');
  } catch (error) {
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    throw new Error(`No se pudo leer el catálogo E2E (${code}).`);
  }

  let catalog;
  try {
    catalog = JSON.parse(source);
  } catch {
    throw new Error('El catálogo E2E no contiene JSON válido.');
  }

  return validateSuiteCatalog(catalog);
}

async function walkFiles(repositoryRoot, relativeDirectory) {
  const files = [];
  const pendingDirectories = [relativeDirectory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    const entries = await readdir(path.join(repositoryRoot, currentDirectory), { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.posix.join(currentDirectory.split(path.sep).join('/'), entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverE2EFiles(repositoryRoot = REPOSITORY_ROOT) {
  const e2eFiles = await walkFiles(repositoryRoot, 'e2e');
  const configFiles = e2eFiles.filter((file) => file.endsWith('/playwright.config.ts'));
  const rootConfig = 'playwright.config.ts';

  if (await fileExists(path.join(repositoryRoot, rootConfig))) {
    configFiles.unshift(rootConfig);
  }

  return {
    configFiles: configFiles.sort(),
    specFiles: e2eFiles.filter((file) => file.endsWith('.spec.ts')).sort(),
  };
}

export async function validateCatalogCoverage(catalog, repositoryRoot = REPOSITORY_ROOT) {
  const validatedCatalog = validateSuiteCatalog(catalog);
  const { configFiles, specFiles } = await discoverE2EFiles(repositoryRoot);
  const declaredConfigs = new Set(validatedCatalog.suites.map((suite) => suite.config));

  for (const configFile of configFiles) {
    if (!declaredConfigs.has(configFile)) {
      throw new Error(`La configuración ${configFile} no está declarada en el catálogo E2E.`);
    }
  }

  for (const suite of validatedCatalog.suites) {
    if (!configFiles.includes(suite.config)) {
      throw new Error(`La configuración catalogada ${suite.config} no existe.`);
    }
  }

  const specCounts = Object.fromEntries(validatedCatalog.suites.map((suite) => [suite.id, 0]));

  for (const specFile of specFiles) {
    const owners = validatedCatalog.suites.filter((suite) => specFile.startsWith(`${suite.specDir}/`));
    if (owners.length !== 1) {
      throw new Error(`El spec ${specFile} debe pertenecer exactamente a una suite catalogada.`);
    }
    specCounts[owners[0].id] += 1;
  }

  for (const suite of validatedCatalog.suites) {
    if (specCounts[suite.id] === 0) {
      throw new Error(`La suite ${suite.id} no contiene ningún spec catalogado.`);
    }
  }

  return { configFiles, specFiles, specCounts };
}

function assertPassthroughArgs(passthroughArgs) {
  for (const argument of passthroughArgs) {
    if (typeof argument !== 'string') {
      throw new Error('Los argumentos de Playwright deben ser strings.');
    }

    if (argument === '--config' || argument.startsWith('--config=') || argument.startsWith('-c')) {
      throw new Error('No se permite reemplazar la configuración catalogada de Playwright.');
    }
  }
}

export function selectRunnableSuite(catalog, argv) {
  const validatedCatalog = validateSuiteCatalog(catalog);
  const [suiteId, ...passthroughArgs] = argv;

  if (!suiteId || suiteId.startsWith('-')) {
    throw new Error(`Uso: yarn test:e2e:suite <${RUNNABLE_SUITE_IDS.join('|')}> [argumentos de Playwright]`);
  }

  const suite = validatedCatalog.suites.find((candidate) => candidate.id === suiteId);
  if (!suite) {
    throw new Error(`Suite E2E desconocida. Suites ejecutables: ${RUNNABLE_SUITE_IDS.join(', ')}.`);
  }

  if (suite.status !== 'runnable' || !RUNNABLE_SUITE_ID_SET.has(suite.id)) {
    throw new Error(`La suite ${suite.id} está en cuarentena: ${suite.reason}`);
  }

  assertPassthroughArgs(passthroughArgs);
  return { suite, passthroughArgs };
}

export function buildPlaywrightInvocation(
  suite,
  passthroughArgs,
  { cwd = REPOSITORY_ROOT, playwrightCli = require.resolve('@playwright/test/cli'), env = process.env } = {},
) {
  assertPassthroughArgs(passthroughArgs);
  return {
    command: process.execPath,
    args: [playwrightCli, 'test', '--config', suite.config, ...passthroughArgs],
    options: {
      cwd,
      env,
      shell: false,
      stdio: 'inherit',
    },
  };
}

export function executePlaywrightSuite(suite, passthroughArgs, dependencies = {}) {
  const spawnImplementation = dependencies.spawnImplementation ?? spawn;
  const invocation = buildPlaywrightInvocation(suite, passthroughArgs, dependencies);

  return new Promise((resolve, reject) => {
    const child = spawnImplementation(invocation.command, invocation.args, invocation.options);
    let settled = false;

    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'UNKNOWN';
      reject(new Error(`No se pudo iniciar Playwright (${code}).`));
    });

    child.once('close', (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

export async function runSuite(argv = process.argv.slice(2)) {
  const catalog = await loadSuiteCatalog();
  await validateCatalogCoverage(catalog);
  const { suite, passthroughArgs } = selectRunnableSuite(catalog, argv);
  return executePlaywrightSuite(suite, passthroughArgs);
}

const isMainModule = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  try {
    process.exitCode = await runSuite();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Falló el runner E2E.');
    process.exitCode = 1;
  }
}
