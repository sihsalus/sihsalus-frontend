#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');

const repoWidePrefixes = ['.yarn/', 'config/', 'packages/tooling/'];

const repoWideFiles = new Set([
  '.yarnrc.yml',
  'biome.json',
  'package.json',
  'turbo.json',
  'yarn.lock',
  'packages/tsconfig.json',
  'packages/vitest.config.js',
]);

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const changedFiles = getChangedFiles(args);
  if (changedFiles.length === 0) {
    console.log('[verify:changed] No changed files detected.');
    return;
  }

  if (changedFiles.some((file) => isRepoWideChange(file))) {
    console.log('[verify:changed] Repo-wide files changed. Running full `yarn verify`.');
    runYarn(['verify']);
    return;
  }

  const workspaceMap = resolveWorkspaces();
  const changedWorkspaces = findChangedWorkspaces(changedFiles, workspaceMap);
  const affectedWorkspaces = includeWorkspaceDependents(changedWorkspaces, workspaceMap);

  if (affectedWorkspaces.length === 0) {
    console.log('[verify:changed] No workspace changes detected. Nothing to verify.');
    return;
  }

  console.log('[verify:changed] Affected workspaces:');
  affectedWorkspaces.forEach((workspaceName) => {
    console.log(`- ${workspaceName}`);
  });

  const turboArgs = ['turbo', 'run', 'lint', 'typescript', 'test'];
  affectedWorkspaces.forEach((workspaceName) => {
    turboArgs.push('--filter', workspaceName);
  });

  runYarn(turboArgs);
}

function parseArgs(argv) {
  const args = {
    base: process.env.VERIFY_CHANGED_BASE || 'HEAD',
    head: process.env.VERIFY_CHANGED_HEAD || '',
    staged: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') {
      args.base = argv[index + 1];
      index += 1;
    } else if (arg === '--head') {
      args.head = argv[index + 1];
      index += 1;
    } else if (arg === '--staged') {
      args.staged = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: yarn verify:changed [--base <git-ref>] [--head <git-ref>] [--staged]

Examples:
- yarn verify:changed --base origin/main
- yarn verify:changed --base origin/main --head HEAD
- yarn verify:changed --staged`);
}

function getChangedFiles(args) {
  const diffArgs = ['diff', '--name-only'];

  if (args.staged) {
    diffArgs.push('--cached');
  } else if (args.head) {
    diffArgs.push(`${args.base}...${args.head}`);
  } else {
    diffArgs.push(args.base);
  }

  const result = spawnSync('git', diffArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Unable to read changed files from git.');
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isRepoWideChange(relativePath) {
  return repoWideFiles.has(relativePath) || repoWidePrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function resolveWorkspaces() {
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
  const workspacePatterns = Array.isArray(rootPackageJson.workspaces) ? rootPackageJson.workspaces : [];
  const workspaces = [];

  workspacePatterns.forEach((workspacePattern) => {
    const normalizedPattern = workspacePattern.replace(/\\/g, '/');
    if (!normalizedPattern.endsWith('/*')) {
      return;
    }

    const relativeParentDir = normalizedPattern.slice(0, -2);
    const absoluteParentDir = path.join(repoRoot, relativeParentDir);
    if (!fs.existsSync(absoluteParentDir)) {
      return;
    }

    fs.readdirSync(absoluteParentDir, { withFileTypes: true }).forEach((entry) => {
      if (!entry.isDirectory()) {
        return;
      }

      const workspaceDir = path.join(absoluteParentDir, entry.name);
      const packageJsonPath = path.join(workspaceDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.name) {
        return;
      }

      workspaces.push({
        name: packageJson.name,
        relativeDir: path.relative(repoRoot, workspaceDir).replace(/\\/g, '/'),
        dependencies: getWorkspaceDependencyNames(packageJson),
      });
    });
  });

  return workspaces.sort((left, right) => left.relativeDir.localeCompare(right.relativeDir));
}

function getWorkspaceDependencyNames(packageJson) {
  const dependencySections = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  return new Set(dependencySections.filter(Boolean).flatMap((dependencies) => Object.keys(dependencies)));
}

function findChangedWorkspaces(changedFiles, workspaceMap) {
  const affected = new Set();

  changedFiles.forEach((changedFile) => {
    workspaceMap.forEach((workspace) => {
      if (changedFile === workspace.relativeDir || changedFile.startsWith(`${workspace.relativeDir}/`)) {
        affected.add(workspace.name);
      }
    });
  });

  return [...affected].sort();
}

function includeWorkspaceDependents(changedWorkspaces, workspaceMap) {
  const workspaceNames = new Set(workspaceMap.map((workspace) => workspace.name));
  const affected = new Set(changedWorkspaces);
  const queue = [...changedWorkspaces];

  while (queue.length > 0) {
    const changedWorkspace = queue.shift();
    if (!workspaceNames.has(changedWorkspace)) {
      continue;
    }

    workspaceMap.forEach((workspace) => {
      if (!affected.has(workspace.name) && workspace.dependencies.has(changedWorkspace)) {
        affected.add(workspace.name);
        queue.push(workspace.name);
      }
    });
  }

  return [...affected].sort();
}

function runYarn(args) {
  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const result = spawnSync(yarnCmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

main();
