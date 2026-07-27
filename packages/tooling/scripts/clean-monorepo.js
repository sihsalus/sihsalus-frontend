#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');
const dryRun = process.argv.includes('--dry-run');

const workspaceArtifactDirs = [
  'dist',
  'coverage',
  '.turbo',
  'storybook-static',
  'playwright-report',
  'test-screenshots',
];

const workspaceArtifactFiles = ['.eslintcache', '.tsbuildinfo', 'tsconfig.tsbuildinfo'];

const rootOnlyTargets = [
  'dist/spa',
  'playwright-report',
  'test-results',
  'test-screenshots',
  '.turbo',
  '.eslintcache',
  '.tsbuildinfo',
];
const rootOnlyFiles = ['e2e/storage-state.json'];
const rootE2EArtifactDirs = ['playwright-report', 'test-results', 'test-screenshots'];
const generatedSourceSuffixes = ['.js', '.js.map', '.d.ts', '.d.ts.map'];
const trackedFiles = new Set(
  execFileSync('git', ['ls-files', '-z', '--', 'packages/libs'], { cwd: repoRoot })
    .toString()
    .split('\0')
    .filter(Boolean)
    .map((relativePath) => path.join(repoRoot, relativePath)),
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveWorkspaceDirectories() {
  const rootPackageJson = readJson(rootPackageJsonPath);
  const workspaces = Array.isArray(rootPackageJson.workspaces) ? rootPackageJson.workspaces : [];
  const directories = new Set();

  for (const workspacePattern of workspaces) {
    const normalizedPattern = workspacePattern.replace(/\\/g, '/');
    if (!normalizedPattern.endsWith('/*')) {
      continue;
    }

    const relativeParentDir = normalizedPattern.slice(0, -2);
    const absoluteParentDir = path.join(repoRoot, relativeParentDir);
    if (!fs.existsSync(absoluteParentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(absoluteParentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const workspaceDir = path.join(absoluteParentDir, entry.name);
      if (fs.existsSync(path.join(workspaceDir, 'package.json'))) {
        directories.add(workspaceDir);
      }
    }
  }

  return [...directories].sort();
}

function removeTarget(targetPath, removedPaths) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  removedPaths.push(path.relative(repoRoot, targetPath) || '.');
  if (!dryRun) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function cleanWorkspace(workspaceDir, removedPaths) {
  for (const dirName of workspaceArtifactDirs) {
    removeTarget(path.join(workspaceDir, dirName), removedPaths);
  }

  for (const fileName of workspaceArtifactFiles) {
    removeTarget(path.join(workspaceDir, fileName), removedPaths);
  }

  if (workspaceDir.startsWith(path.join(repoRoot, 'packages/libs') + path.sep)) {
    cleanGeneratedLibrarySource(path.join(workspaceDir, 'src'), removedPaths);
  }
}

function cleanGeneratedLibrarySource(directory, removedPaths) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      cleanGeneratedLibrarySource(entryPath, removedPaths);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const suffix = generatedSourceSuffixes.find((candidate) => entry.name.endsWith(candidate));
    if (!suffix || trackedFiles.has(entryPath)) {
      continue;
    }
    removeTarget(entryPath, removedPaths);
  }
}

function cleanRoot(removedPaths) {
  for (const relativeTarget of rootOnlyTargets) {
    removeTarget(path.join(repoRoot, relativeTarget), removedPaths);
  }

  for (const relativeFile of rootOnlyFiles) {
    removeTarget(path.join(repoRoot, relativeFile), removedPaths);
  }

  const e2eRoot = path.join(repoRoot, 'e2e');
  if (!fs.existsSync(e2eRoot)) {
    return;
  }

  for (const entry of fs.readdirSync(e2eRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const suiteDir = path.join(e2eRoot, entry.name);
    for (const artifactDir of rootE2EArtifactDirs) {
      removeTarget(path.join(suiteDir, artifactDir), removedPaths);
    }
    removeTarget(path.join(suiteDir, 'storageState.json'), removedPaths);
  }
}

function main() {
  const removedPaths = [];
  const workspaceDirs = resolveWorkspaceDirectories();

  cleanRoot(removedPaths);
  workspaceDirs.forEach((workspaceDir) => {
    cleanWorkspace(workspaceDir, removedPaths);
  });

  const verb = dryRun ? 'Would remove' : 'Removed';
  if (removedPaths.length === 0) {
    console.log(`No generated artifacts found${dryRun ? ' to remove' : ''}.`);
    return;
  }

  console.log(`${verb} ${removedPaths.length} generated artifact${removedPaths.length === 1 ? '' : 's'}:`);
  removedPaths.forEach((removedPath) => {
    console.log(`- ${removedPath}`);
  });
}

main();
