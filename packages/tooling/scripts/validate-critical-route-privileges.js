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
  'esm-patient-chart-app',
  'esm-patient-registration-app',
  'esm-salud-materna-app',
  'esm-service-queues-app',
  'esm-stock-management-app',
  'esm-ward-app',
];

/**
 * Sections enforced per app, when a subset is appropriate.
 *
 * `extensions` are surfaces rendered inside a context the user already reached;
 * `pages`, `modals` and `workspaces` are where an action is actually taken. For
 * an app that is itself entered through a guard, enforcing the action sections
 * is what fails closed, while demanding a privilege on every display widget only
 * produces exemptions nobody reads.
 */
const enforcedSectionsByApp = {
  // The chart is entered through patient-level guards, and its extensions are
  // widgets and navigation within it. The clinical actions — starting a visit,
  // registering a companion — live in its modals and workspaces, which is where
  // the missing guard on visit-companion-registration-workspace went unnoticed.
  'esm-patient-chart-app': ['pages', 'workspaces', 'workspaces2', 'modals'],
};

/**
 * Entries that legitimately carry no `privileges` in the manifest, each with the
 * reason it cannot.
 *
 * The manifest's `privileges` array is an AND: the user must hold every listed
 * privilege. A guard expressed as an OR of alternatives therefore cannot be
 * written here at all, and has to live in code. Those entries are listed below
 * with the function that guards them, so an exemption is a documented decision
 * rather than an omission nobody noticed.
 *
 * Keyed by `<app>/<section>/<name>`. A reason is mandatory; an entry whose
 * reason is missing or blank fails the same as an unguarded route.
 */
const guardExemptions = {
  'esm-patient-chart-app/pages/root': {
    reason:
      'The chart shell itself. It renders no clinical action; every widget inside it declares its own guard, ' +
      'and access to a patient chart is governed by the patient-level privileges those widgets carry.',
  },
  'esm-patient-chart-app/modals/start-visit-dialog': {
    reason:
      'Guarded in code by canStartVisit (src/visit/visit-access.ts), which is an OR of Add Visits, ' +
      'app:hoja.clinica.visitas.editar and app:home.admision. The manifest ANDs its privileges, so requiring all ' +
      'three here would lock out Admision, which reaches the flow through app:home.admision alone.',
  },
  'esm-patient-chart-app/workspaces2/start-visit-workspace-form': {
    reason:
      'Same OR guard as start-visit-dialog, applied by canStartVisit at src/visit/visit-form/visit-form.workspace.tsx ' +
      'before the form renders, so a direct launch is refused too.',
  },
};

function exemptionKey(appName, section, name) {
  return `${appName}/${section}/${name}`;
}

function findMissingPrivileges(routes, appName, exemptions = guardExemptions) {
  const failures = [];
  for (const section of enforcedSectionsByApp[appName] ?? guardedSections) {
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

      const name = entry.name ?? entry.component ?? entry.route ?? '<unnamed>';
      const exemption = exemptions[exemptionKey(appName, section, name)];

      if (exemption && typeof exemption.reason === 'string' && exemption.reason.trim()) {
        continue;
      }

      failures.push({ appName, section, name });
    }
  }
  return failures;
}

/**
 * An exemption for a route that has since been guarded, renamed or deleted is
 * itself a failure: it would silently excuse a future route that reuses the key.
 */
function findStaleExemptions(root = repoRoot, exemptions = guardExemptions) {
  const unguarded = new Set();

  for (const appName of criticalApps) {
    const routePath = path.join(root, 'packages/apps', appName, 'src/routes.json');
    if (!fs.existsSync(routePath)) {
      continue;
    }
    const routes = JSON.parse(fs.readFileSync(routePath, 'utf8'));
    for (const failure of findMissingPrivileges(routes, appName, {})) {
      unguarded.add(exemptionKey(failure.appName, failure.section, failure.name));
    }
  }

  return Object.keys(exemptions).filter((key) => !unguarded.has(key));
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
  const stale = findStaleExemptions();

  if (failures.length > 0) {
    console.error('[route-privileges] Critical route guards are incomplete:');
    for (const failure of failures) {
      console.error(`- ${failure.appName} ${failure.section}:${failure.name}`);
    }
    console.error(
      '\nDeclare `privileges` on the route, or, if the guard is an OR that the manifest cannot express, ' +
        'add it to guardExemptions with the reason and the function that enforces it.',
    );
  }

  if (stale.length > 0) {
    console.error('\n[route-privileges] Exemptions for routes that are no longer unguarded:');
    for (const key of stale) {
      console.error(`- ${key}`);
    }
    console.error('\nRemove them. A stale exemption would excuse a future route that reuses the same key.');
  }

  if (failures.length > 0 || stale.length > 0) {
    process.exit(1);
  }

  const exemptCount = Object.keys(guardExemptions).length;
  console.log(
    `[route-privileges] All ${criticalApps.length} critical applications fail closed at route level ` +
      `(${exemptCount} documented exemptions guarded in code).`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  criticalApps,
  findMissingPrivileges,
  findStaleExemptions,
  guardExemptions,
  validateCriticalRoutePrivileges,
};
