#!/usr/bin/env node

/**
 * generate-assemble-config.js
 *
 * Scans packages/apps/* and generates config/spa-assemble-config.json
 * listing all locally-buildable frontend modules.
 *
 * Run: node packages/tooling/scripts/generate-assemble-config.js
 * Or:  yarn generate-config
 *
 * The output file is the authoritative input for assemble-importmap.js.
 * Local builds always take precedence at assemble time; external @openmrs/*
 * packages can still be appended manually for modules not yet in the monorepo.
 */

const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');

const logInfo = (msg) => console.log(`${chalk.cyan.bold('[gen-config]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[gen-config]')} ${chalk.yellow(msg)}`);

const appsDir = 'packages/apps';
const outPath = process.env.SPA_ASSEMBLE_CONFIG || 'config/spa-assemble-config.json';

const frontendModules = {};
const skipped = [];

const dirs = fs
  .readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('esm-'))
  .map((d) => path.join(appsDir, d.name));

for (const dir of dirs) {
  const pkgPath = path.join(dir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    skipped.push(`${dir} — no package.json`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (pkg.private) {
    skipped.push(`${pkg.name} — private`);
    continue;
  }

  const browserField = pkg.browser || pkg.module || pkg.main;
  if (!browserField) {
    skipped.push(`${pkg.name} — no browser/module/main field`);
    continue;
  }

  frontendModules[pkg.name] = pkg.version || '0.0.0';
}

if (skipped.length > 0) {
  logWarn(`Skipped ${skipped.length} package(s):`);
  for (const s of skipped) logWarn(`  - ${s}`);
}

const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { frontendModules: {} };

// Preserve any manually-added external (@openmrs/* or other) entries
// that are NOT overridden by a local package with the same base name
const localBaseNames = new Set(Object.keys(frontendModules).map((n) => n.replace(/^@[^/]+\//, '')));

const externalEntries = Object.entries(existing.frontendModules || {}).filter(([name]) => {
  if (name.startsWith('@sihsalus/')) {
    return false;
  }

  const baseName = name.replace(/^@[^/]+\//, '');
  return !localBaseNames.has(baseName);
});

const merged = {
  frontendModules: {
    ...frontendModules,
    ...Object.fromEntries(externalEntries),
  },
};

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');

const localCount = Object.keys(frontendModules).length;
const externalCount = externalEntries.length;
logInfo(`Generated ${outPath}`);
logInfo(`  ${localCount} local workspace package(s)`);
if (externalCount > 0) {
  logInfo(`  ${externalCount} external package(s) preserved from previous config`);
}
