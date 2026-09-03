#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const defaultRepositoryRoot = path.resolve(__dirname, '../../..');
const governanceConfigPath = 'config/test-governance.json';
const ignoredDirectoryNames = new Set([
  '.cache',
  '.rspack',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const allowedMissingItems = ['test-script', 'test-files'];
const allowedPriorities = new Set(['P0', 'P1', 'P2']);
const allowedRisks = new Set(['high', 'medium', 'low']);
const maximumExceptionDays = 180;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const testFileExpression = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getWorkspacePatterns(rootManifest) {
  if (Array.isArray(rootManifest.workspaces)) {
    return rootManifest.workspaces;
  }

  if (Array.isArray(rootManifest.workspaces?.packages)) {
    return rootManifest.workspaces.packages;
  }

  return [];
}

function resolveWorkspaceDirectories(repositoryRoot) {
  const rootManifest = readJson(path.join(repositoryRoot, 'package.json'));
  const patterns = getWorkspacePatterns(rootManifest);
  const directories = [];

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      throw new Error('Root workspace patterns must be strings.');
    }

    if (pattern.endsWith('/*') && !pattern.slice(0, -2).includes('*')) {
      const parentDirectory = path.join(repositoryRoot, pattern.slice(0, -2));
      if (!fs.existsSync(parentDirectory)) {
        continue;
      }

      for (const entry of fs.readdirSync(parentDirectory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          directories.push(path.join(parentDirectory, entry.name));
        }
      }
      continue;
    }

    if (pattern.includes('*')) {
      throw new Error(`Unsupported workspace pattern "${pattern}". Only direct paths and trailing /* are supported.`);
    }

    directories.push(path.join(repositoryRoot, pattern));
  }

  return directories.sort();
}

function isTestFile(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  const fileName = path.posix.basename(normalizedPath);
  return testFileExpression.test(fileName);
}

function findTestFiles(workspaceDirectory, currentDirectory = workspaceDirectory, results = []) {
  if (!fs.existsSync(currentDirectory)) {
    return results;
  }

  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      findTestFiles(workspaceDirectory, entryPath, results);
      continue;
    }

    if (entry.isFile()) {
      const relativePath = path.relative(workspaceDirectory, entryPath);
      if (isTestFile(relativePath)) {
        results.push(normalizePath(relativePath));
      }
    }
  }

  return results.sort();
}

function getPassWithNoTestsScripts(manifest) {
  if (!manifest?.scripts || typeof manifest.scripts !== 'object') {
    return [];
  }

  return Object.entries(manifest.scripts)
    .filter(([, command]) => typeof command === 'string' && command.includes('--passWithNoTests'))
    .map(([scriptName]) => scriptName)
    .sort();
}

function collectWorkspaces(repositoryRoot) {
  const workspaces = [];

  for (const workspaceDirectory of resolveWorkspaceDirectories(repositoryRoot)) {
    const manifestPath = path.join(workspaceDirectory, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = readJson(manifestPath);
    const relativePath = normalizePath(path.relative(repositoryRoot, workspaceDirectory));
    const testFiles = findTestFiles(workspaceDirectory);
    const hasTestScript = typeof manifest.scripts?.test === 'string' && manifest.scripts.test.trim().length > 0;
    const missing = [];

    if (!hasTestScript) {
      missing.push('test-script');
    }
    if (testFiles.length === 0) {
      missing.push('test-files');
    }

    workspaces.push({
      name: manifest.name,
      path: relativePath,
      manifest,
      manifestPath: `${relativePath}/package.json`,
      testFiles,
      missing,
      passWithNoTestsScripts: getPassWithNoTestsScripts(manifest),
    });
  }

  return workspaces.sort((left, right) => left.path.localeCompare(right.path));
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return null;
  }

  return timestamp;
}

function isOwner(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const githubTeam = /^@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
  return email.test(value) || githubTeam.test(value);
}

function sameItems(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function validateExceptionMetadata(exception, index, recordedOnTimestamp, todayTimestamp) {
  const failures = [];
  const label = `Exception ${index + 1}`;
  const allowedFields = new Set(['workspace', 'path', 'owner', 'risk', 'priority', 'missing', 'reason', 'expiresOn']);

  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) {
    return [`${label} must be an object.`];
  }

  const unknownFields = Object.keys(exception).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    failures.push(`${label} has unsupported field(s): ${unknownFields.sort().join(', ')}.`);
  }

  if (typeof exception.workspace !== 'string' || exception.workspace.trim().length === 0) {
    failures.push(`${label} must declare a non-empty workspace name.`);
  }

  if (
    typeof exception.path !== 'string' ||
    !exception.path.startsWith('packages/') ||
    exception.path.includes('\\') ||
    path.posix.normalize(exception.path) !== exception.path
  ) {
    failures.push(`${label} must declare a normalized repository path below packages/.`);
  }

  if (!isOwner(exception.owner)) {
    failures.push(`${label} owner must be a contact email or GitHub team such as @org/team.`);
  }

  if (!allowedRisks.has(exception.risk)) {
    failures.push(`${label} risk must be one of: ${[...allowedRisks].join(', ')}.`);
  }

  if (!allowedPriorities.has(exception.priority)) {
    failures.push(`${label} priority must be one of: ${[...allowedPriorities].join(', ')}.`);
  }

  if (!Array.isArray(exception.missing) || exception.missing.length === 0) {
    failures.push(`${label} missing must be a non-empty array.`);
  } else {
    const invalidMissingItems = exception.missing.filter((item) => !allowedMissingItems.includes(item));
    if (invalidMissingItems.length > 0) {
      failures.push(`${label} has unsupported missing item(s): ${invalidMissingItems.join(', ')}.`);
    }
    if (new Set(exception.missing).size !== exception.missing.length) {
      failures.push(`${label} missing items must be unique.`);
    }
    const orderedMissing = allowedMissingItems.filter((item) => exception.missing.includes(item));
    if (!sameItems(exception.missing, orderedMissing)) {
      failures.push(`${label} missing items must follow this order: ${allowedMissingItems.join(', ')}.`);
    }
  }

  if (
    typeof exception.reason !== 'string' ||
    exception.reason.trim().length < 40 ||
    /\b(?:TODO|TBD|unknown|unassigned)\b|por definir/i.test(exception.reason)
  ) {
    failures.push(`${label} reason must be concrete, at least 40 characters, and contain no placeholder.`);
  }

  const expiresOnTimestamp = parseIsoDate(exception.expiresOn);
  if (expiresOnTimestamp === null) {
    failures.push(`${label} expiresOn must be a real ISO date (YYYY-MM-DD).`);
  } else {
    if (recordedOnTimestamp !== null && expiresOnTimestamp < recordedOnTimestamp) {
      failures.push(`${label} expiresOn cannot precede recordedOn.`);
    }
    if (expiresOnTimestamp < todayTimestamp) {
      failures.push(`${label} expired on ${exception.expiresOn}. Remove or explicitly renew it.`);
    }
    if (
      recordedOnTimestamp !== null &&
      (expiresOnTimestamp - recordedOnTimestamp) / millisecondsPerDay > maximumExceptionDays
    ) {
      failures.push(`${label} exceeds the ${maximumExceptionDays}-day maximum exception window.`);
    }
  }

  return failures;
}

function validateGitRef(baseRef) {
  return typeof baseRef === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/@{}^~+-]*$/.test(baseRef);
}

function verifyGitRef(repositoryRoot, baseRef) {
  execFileSync('git', ['rev-parse', '--verify', `${baseRef}^{commit}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readManifestAtGitRef({ repositoryRoot, baseRef, relativePath }) {
  try {
    const contents = execFileSync('git', ['show', `${baseRef}:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(contents);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${relativePath} at ${baseRef} is not valid JSON: ${error.message}`);
    }
    return null;
  }
}

function validateTestGovernance(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const configRelativePath = options.configRelativePath ?? governanceConfigPath;
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const baseRef = options.baseRef;
  const failures = [];
  let config;
  let workspaces;

  try {
    config = readJson(path.join(repositoryRoot, configRelativePath));
  } catch (error) {
    return {
      failures: [`Unable to read ${configRelativePath}: ${error.message}`],
      summary: { workspaceCount: 0, gapCount: 0, exceptionCount: 0, passWithNoTestsCount: 0 },
    };
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      failures: [`${configRelativePath} must contain a JSON object.`],
      summary: { workspaceCount: 0, gapCount: 0, exceptionCount: 0, passWithNoTestsCount: 0 },
    };
  }

  try {
    workspaces = collectWorkspaces(repositoryRoot);
  } catch (error) {
    return {
      failures: [`Unable to inventory workspaces: ${error.message}`],
      summary: { workspaceCount: 0, gapCount: 0, exceptionCount: 0, passWithNoTestsCount: 0 },
    };
  }

  if (workspaces.length === 0) {
    failures.push('Workspace inventory is empty; refusing to validate an incomplete repository scope.');
  }

  if (config.version !== 1) {
    failures.push(`${configRelativePath} version must be 1.`);
  }

  const configFields = Object.keys(config).sort();
  const expectedConfigFields = ['exceptions', 'recordedOn', 'version'];
  if (!sameItems(configFields, expectedConfigFields)) {
    failures.push(`${configRelativePath} must contain exactly: ${expectedConfigFields.join(', ')}.`);
  }

  const recordedOnTimestamp = parseIsoDate(config.recordedOn);
  const todayTimestamp = parseIsoDate(today);
  if (recordedOnTimestamp === null) {
    failures.push(`${configRelativePath} recordedOn must be a real ISO date (YYYY-MM-DD).`);
  }
  if (todayTimestamp === null) {
    failures.push(`Validation date "${today}" is not a real ISO date (YYYY-MM-DD).`);
  }
  if (recordedOnTimestamp !== null && todayTimestamp !== null && recordedOnTimestamp > todayTimestamp) {
    failures.push(`${configRelativePath} recordedOn cannot be in the future.`);
  }

  const exceptions = Array.isArray(config.exceptions) ? config.exceptions : [];
  if (!Array.isArray(config.exceptions)) {
    failures.push(`${configRelativePath} exceptions must be an array.`);
  }

  const effectiveTodayTimestamp = todayTimestamp ?? Number.POSITIVE_INFINITY;
  exceptions.forEach((exception, index) => {
    failures.push(...validateExceptionMetadata(exception, index, recordedOnTimestamp, effectiveTodayTimestamp));
  });

  const workspaceByName = new Map();
  const workspaceByPath = new Map();
  for (const workspace of workspaces) {
    if (typeof workspace.name !== 'string' || workspace.name.length === 0) {
      failures.push(`${workspace.manifestPath} must declare a non-empty package name.`);
      continue;
    }
    if (workspaceByName.has(workspace.name)) {
      failures.push(`Duplicate workspace name "${workspace.name}" at ${workspace.path}.`);
    }
    workspaceByName.set(workspace.name, workspace);
    workspaceByPath.set(workspace.path, workspace);
  }

  const exceptionByName = new Map();
  const exceptionByPath = new Map();
  for (const exception of exceptions) {
    if (!exception || typeof exception !== 'object') {
      continue;
    }
    if (typeof exception.workspace === 'string') {
      if (exceptionByName.has(exception.workspace)) {
        failures.push(`Duplicate governance exception for workspace "${exception.workspace}".`);
      } else {
        exceptionByName.set(exception.workspace, exception);
      }
    }
    if (typeof exception.path === 'string') {
      if (exceptionByPath.has(exception.path)) {
        failures.push(`Duplicate governance exception for path "${exception.path}".`);
      } else {
        exceptionByPath.set(exception.path, exception);
      }
    }
  }

  for (const workspace of workspaces) {
    const exception = exceptionByName.get(workspace.name);
    if (workspace.missing.length > 0 && !exception) {
      failures.push(
        `${workspace.name} (${workspace.path}) is missing ${workspace.missing.join(' and ')} without a governance exception.`,
      );
      continue;
    }

    if (workspace.missing.length === 0 && exception) {
      failures.push(`${workspace.name} has tests and a test script; remove its stale governance exception.`);
      continue;
    }

    if (!exception) {
      continue;
    }

    if (exception.path !== workspace.path) {
      failures.push(
        `${workspace.name} exception path is "${exception.path}" but the workspace is at "${workspace.path}".`,
      );
    }

    if (Array.isArray(exception.missing) && !sameItems(exception.missing, workspace.missing)) {
      failures.push(
        `${workspace.name} exception records [${exception.missing.join(', ')}] but currently misses [${workspace.missing.join(', ')}].`,
      );
    }
  }

  for (const exception of exceptions) {
    if (!exception || typeof exception !== 'object') {
      continue;
    }
    if (typeof exception.workspace === 'string' && !workspaceByName.has(exception.workspace)) {
      failures.push(`Governance exception references unknown workspace "${exception.workspace}".`);
    }
    if (typeof exception.path === 'string' && !workspaceByPath.has(exception.path)) {
      failures.push(`Governance exception references unknown path "${exception.path}".`);
    }
  }

  if (baseRef !== undefined) {
    if (!validateGitRef(baseRef)) {
      failures.push(`Invalid base ref "${baseRef}".`);
    } else {
      const readManifestAtRef = options.readManifestAtRef ?? readManifestAtGitRef;
      let canReadBase = true;

      if (!options.readManifestAtRef) {
        try {
          verifyGitRef(repositoryRoot, baseRef);
        } catch (error) {
          failures.push(`Unable to resolve base ref "${baseRef}": ${error.message}`);
          canReadBase = false;
        }
      }

      if (canReadBase) {
        let baseConfig = null;
        try {
          baseConfig = readManifestAtRef({ repositoryRoot, baseRef, relativePath: configRelativePath });
        } catch (error) {
          failures.push(`Unable to read ${configRelativePath} at ${baseRef}: ${error.message}`);
        }

        if (Array.isArray(baseConfig?.exceptions)) {
          const baseExceptions = new Set(baseConfig.exceptions.map((exception) => exception.workspace));
          for (const exception of exceptions) {
            if (typeof exception?.workspace === 'string' && !baseExceptions.has(exception.workspace)) {
              failures.push(
                `New no-test exception "${exception.workspace}" is not allowed; add discoverable tests instead.`,
              );
            }
          }
        }

        for (const workspace of workspaces) {
          if (workspace.passWithNoTestsScripts.length === 0) {
            continue;
          }

          let baseManifest = null;
          try {
            baseManifest = readManifestAtRef({
              repositoryRoot,
              baseRef,
              relativePath: workspace.manifestPath,
            });
          } catch (error) {
            failures.push(`Unable to read ${workspace.manifestPath} at ${baseRef}: ${error.message}`);
            continue;
          }

          const baseScripts = new Set(getPassWithNoTestsScripts(baseManifest));
          for (const scriptName of workspace.passWithNoTestsScripts) {
            if (!baseScripts.has(scriptName)) {
              failures.push(
                `${workspace.name} adds --passWithNoTests to script "${scriptName}"; new suppressions are not allowed.`,
              );
            }
          }
        }
      }
    }
  }

  const gapCount = workspaces.filter((workspace) => workspace.missing.length > 0).length;
  const passWithNoTestsCount = workspaces.filter((workspace) => workspace.passWithNoTestsScripts.length > 0).length;

  return {
    failures,
    summary: {
      workspaceCount: workspaces.length,
      gapCount,
      exceptionCount: exceptions.length,
      passWithNoTestsCount,
    },
  };
}

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--base') {
      const baseRef = argv[index + 1];
      if (!baseRef) {
        throw new Error('--base requires a Git ref.');
      }
      options.baseRef = baseRef;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument "${argument}".`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: yarn validate:test-governance [--base <git-ref>]

Validates discoverable workspace tests and time-bounded exceptions. When a
base ref is provided, also rejects new --passWithNoTests suppressions and new
no-test exceptions. CI must always provide the PR or push base ref.`);
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const result = validateTestGovernance({ baseRef: options.baseRef });
  const { workspaceCount, gapCount, exceptionCount, passWithNoTestsCount } = result.summary;

  if (result.failures.length > 0) {
    console.error(`✖ Test governance failed with ${result.failures.length} issue(s):\n`);
    for (const failure of result.failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ Test governance OK — ${workspaceCount} workspaces, ${gapCount} documented gaps, ` +
      `${exceptionCount} active exceptions, ${passWithNoTestsCount} legacy suppressions.`,
  );
  if (!options.baseRef) {
    console.log('ℹ New --passWithNoTests suppressions were not compared; pass --base <git-ref> for the CI ratchet.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectWorkspaces,
  findTestFiles,
  getPassWithNoTestsScripts,
  isTestFile,
  maximumExceptionDays,
  parseArguments,
  validateTestGovernance,
};
