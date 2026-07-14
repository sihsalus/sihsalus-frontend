#!/usr/bin/env node
/**
 * Global route registrations are keyed only by name. A duplicate modal or
 * workspace silently replaces an earlier registration (workspace v2 throws at
 * runtime), which can also replace its privilege contract. Fail in CI instead.
 */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const routeCollections = [
  { key: 'modals', namespace: 'modal' },
  { key: 'workspaces', namespace: 'workspace-v1' },
  { key: 'workspaces2', namespace: 'workspace-v2' },
];

function findDuplicateRouteRegistrations(routeFiles) {
  const registrations = new Map();

  for (const { file, routes } of routeFiles) {
    for (const { key, namespace } of routeCollections) {
      for (const definition of routes[key] ?? []) {
        if (!definition || typeof definition.name !== 'string' || definition.name.length === 0) continue;

        const registrationKey = `${namespace}:${definition.name}`;
        const entries = registrations.get(registrationKey) ?? [];
        entries.push({
          component: definition.component,
          file,
          name: definition.name,
          namespace,
          privileges: definition.privileges,
        });
        registrations.set(registrationKey, entries);
      }
    }
  }

  return [...registrations.values()]
    .filter((entries) => entries.length > 1)
    .sort((left, right) =>
      `${left[0].namespace}:${left[0].name}`.localeCompare(`${right[0].namespace}:${right[0].name}`),
    );
}

function loadApplicationRouteFiles(root = repoRoot) {
  const appsDirectory = path.join(root, 'packages/apps');
  if (!fs.existsSync(appsDirectory)) return [];

  return fs
    .readdirSync(appsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsDirectory, entry.name, 'src/routes.json'))
    .filter((routePath) => fs.existsSync(routePath))
    .map((routePath) => ({
      file: path.relative(root, routePath),
      routes: JSON.parse(fs.readFileSync(routePath, 'utf8')),
    }));
}

function validateRouteRegistrationNames(root = repoRoot) {
  const routeFiles = loadApplicationRouteFiles(root);
  const duplicates = findDuplicateRouteRegistrations(routeFiles);

  if (duplicates.length === 0) {
    console.log(`✓ Route registration names are globally unique across ${routeFiles.length} applications.`);
    return true;
  }

  console.error(`✖ Found ${duplicates.length} duplicate global route registration name(s):`);
  for (const entries of duplicates) {
    console.error(`\n  ${entries[0].namespace}: ${entries[0].name}`);
    for (const entry of entries) {
      console.error(
        `    - ${entry.file} (component=${entry.component ?? 'missing'}, privileges=${entry.privileges ?? 'none'})`,
      );
    }
  }
  return false;
}

if (require.main === module && !validateRouteRegistrationNames()) {
  process.exit(1);
}

module.exports = {
  findDuplicateRouteRegistrations,
  loadApplicationRouteFiles,
  validateRouteRegistrationNames,
};
