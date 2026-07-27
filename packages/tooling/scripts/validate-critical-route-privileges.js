#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const guardedSections = ['pages', 'extensions', 'workspaces', 'workspaces2', 'modals'];
const criticalApps = [
  'esm-appointments-app',
  'esm-atencion-ambulatoria-app',
  'esm-billing-app',
  'esm-crecimiento-desarrollo-app',
  'esm-dispensing-app',
  'esm-emergency-app',
  'esm-fua-app',
  'esm-laboratory-app',
  'esm-odontologia-app',
  'esm-patient-registration-app',
  'esm-salud-materna-app',
  'esm-service-queues-app',
  'esm-stock-management-app',
  'esm-ward-app',
];

function findMissingPrivileges(routes, appName) {
  const failures = [];
  for (const section of guardedSections) {
    for (const entry of routes[section] ?? []) {
      if (typeof entry.privileges === 'string' && entry.privileges.trim()) {
        continue;
      }
      if (
        Array.isArray(entry.privileges) &&
        entry.privileges.length > 0 &&
        entry.privileges.every((privilege) => typeof privilege === 'string' && privilege.trim())
      ) {
        continue;
      }
      failures.push({
        appName,
        section,
        name: entry.name ?? entry.component ?? entry.route ?? '<unnamed>',
      });
    }
  }
  return failures;
}

function validateCriticalRoutePrivileges(root = repoRoot) {
  const failures = [];
  for (const appName of criticalApps) {
    const routePath = path.join(root, 'packages/apps', appName, 'src/routes.json');
    if (!fs.existsSync(routePath)) {
      failures.push({ appName, section: 'routes', name: '<missing routes.json>' });
      continue;
    }
    const routes = JSON.parse(fs.readFileSync(routePath, 'utf8'));
    failures.push(...findMissingPrivileges(routes, appName));
  }
  return failures;
}

function main() {
  const failures = validateCriticalRoutePrivileges();
  if (failures.length > 0) {
    console.error('[route-privileges] Critical route guards are incomplete:');
    for (const failure of failures) {
      console.error(`- ${failure.appName} ${failure.section}:${failure.name}`);
    }
    process.exit(1);
  }
  console.log(`[route-privileges] All ${criticalApps.length} critical applications fail closed at route level.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  criticalApps,
  findMissingPrivileges,
  validateCriticalRoutePrivileges,
};
