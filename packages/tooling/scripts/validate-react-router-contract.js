#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const targetVersion = '7.18.2';
const peerRange = '>=6.30.4 <8';
const runtimePackageRoots = ['packages/apps', 'packages/libs', 'packages/templates'];
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const routerPackages = ['react-router', 'react-router-dom'];
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache', '.rspack']);
const sourceExtension = /\.[cm]?[jt]sx?$/;
const routerImport =
  /\b(?:from\s*|import\s*\(|require\()\s*['"]react-router(?:-dom)?(?:\/[^'"]*)?['"]|\bimport\s*['"]react-router(?:-dom)?(?:\/[^'"]*)?['"]/;
const removedFutureFlag =
  /\bv7_(?:relativeSplatPath|startTransition|fetcherPersist|normalizeFormMethod|partialHydration|skipActionStatusRevalidation)\b/;
const unstableRscApi =
  /\b(?:unstable_|UNSAFE_)[A-Za-z0-9_]*RSC[A-Za-z0-9_]*\b|react-router\/unstable_rsc|react-server-dom(?:-[A-Za-z0-9_-]+)?/;

function findFiles(directory, predicate, results = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      findFiles(filePath, predicate, results);
    } else if (entry.isFile() && predicate(filePath)) {
      results.push(filePath);
    }
  }
  return results.sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(root, manifestPath, failures, scanSource = false) {
  const manifest = readJson(manifestPath);
  const relativePath = path.relative(root, manifestPath);

  for (const section of dependencySections) {
    for (const dependencyName of Object.keys(manifest[section] ?? {})) {
      if (/^react-server-dom(?:-|$)/.test(dependencyName)) {
        failures.push(`${relativePath}: ${section}.${dependencyName} enables the vulnerable RSC-only code path.`);
      }
    }
  }

  for (const dependencyName of routerPackages) {
    const peerVersion = manifest.peerDependencies?.[dependencyName];
    if (peerVersion !== undefined && peerVersion !== peerRange) {
      failures.push(`${relativePath}: peer ${dependencyName} must be "${peerRange}", found "${peerVersion}".`);
    }

    for (const section of dependencySections.filter((name) => name !== 'peerDependencies')) {
      const version = manifest[section]?.[dependencyName];
      if (version !== undefined && version !== targetVersion) {
        failures.push(`${relativePath}: ${section}.${dependencyName} must be "${targetVersion}", found "${version}".`);
      }
    }
  }

  if (!scanSource) {
    return;
  }

  const sourceFiles = findFiles(path.dirname(manifestPath), (filePath) => sourceExtension.test(filePath));
  const importsRouter = sourceFiles.some((filePath) => routerImport.test(fs.readFileSync(filePath, 'utf8')));
  if (importsRouter && manifest.peerDependencies?.['react-router-dom'] !== peerRange) {
    failures.push(
      `${relativePath}: source imports React Router but peerDependencies.react-router-dom is not "${peerRange}".`,
    );
  }

  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    if (removedFutureFlag.test(source)) {
      failures.push(`${path.relative(root, sourceFile)}: contains a removed React Router v6 future flag.`);
    }
    if (unstableRscApi.test(source)) {
      failures.push(
        `${path.relative(root, sourceFile)}: uses an unstable React Router RSC API outside the supported SPA contract.`,
      );
    }
  }
}

function validateLockfile(root, lockfilePath, failures) {
  const lockfile = fs.readFileSync(lockfilePath, 'utf8');
  for (const dependencyName of routerPackages) {
    const expression = new RegExp(`"${dependencyName}@npm:([^"]+)"`, 'g');
    for (const match of lockfile.matchAll(expression)) {
      if (match[1] !== targetVersion) {
        failures.push(
          `${path.relative(root, lockfilePath)}: ${dependencyName} resolves to ${match[1]}, expected ${targetVersion}.`,
        );
      }
    }
  }
}

function validateReactRouterContract(root = repoRoot) {
  const failures = [];
  const rootManifestPath = path.join(root, 'package.json');
  const rootManifest = readJson(rootManifestPath);

  for (const dependencyName of routerPackages) {
    const version = rootManifest.resolutions?.[dependencyName];
    if (version !== targetVersion) {
      failures.push(`package.json: resolutions.${dependencyName} must be "${targetVersion}", found "${version}".`);
    }
  }

  validateManifest(root, rootManifestPath, failures);

  const runtimeRoots = runtimePackageRoots.map((packageRoot) => `${path.join(root, packageRoot)}${path.sep}`);
  for (const manifestPath of findFiles(
    path.join(root, 'packages'),
    (filePath) => path.basename(filePath) === 'package.json',
  )) {
    const scanSource = runtimeRoots.some((runtimeRoot) => manifestPath.startsWith(runtimeRoot));
    validateManifest(root, manifestPath, failures, scanSource);
  }

  validateLockfile(root, path.join(root, 'yarn.lock'), failures);
  return failures;
}

function main() {
  const failures = validateReactRouterContract();
  if (failures.length > 0) {
    console.error('[react-router-contract] Version or sharing contract is inconsistent:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log(
    `[react-router-contract] Runtime locked to ${targetVersion}; importers share peer ${peerRange}; no v6 flags or RSC APIs remain.`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  peerRange,
  targetVersion,
  validateReactRouterContract,
};
