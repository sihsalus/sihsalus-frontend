#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const logInfo = (msg) => console.log(`${chalk.green.bold('[validate-spa]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[validate-spa]')} ${chalk.yellow(msg)}`);
const logFail = (msg) => console.error(`${chalk.red.bold('[validate-spa]')} ${chalk.red(msg)}`);

const outDir = process.env.SPA_OUTPUT_DIR || 'dist/spa';
const assembleConfigPath = process.env.SPA_ASSEMBLE_CONFIG || 'config/spa-assemble-config.json';
const requiredFiles = ['index.html', 'importmap.json', 'routes.registry.json', 'frontend.json'];

let failed = false;

function fail(message) {
  failed = true;
  logFail(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${filePath}: ${error.message}`);
    return null;
  }
}

logInfo(`Validating ${outDir}`);

if (!fs.existsSync(outDir)) {
  fail(`SPA output directory does not exist: ${outDir}`);
  process.exit(1);
}

for (const file of requiredFiles) {
  const filePath = path.join(outDir, file);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  } else if (fs.statSync(filePath).size === 0) {
    fail(`Required file is empty: ${filePath}`);
  }
}

const importmapPath = path.join(outDir, 'importmap.json');
const routesPath = path.join(outDir, 'routes.registry.json');
const importmap = fs.existsSync(importmapPath) ? readJson(importmapPath) : null;
const routesRegistry = fs.existsSync(routesPath) ? readJson(routesPath) : null;

const imports = importmap?.imports || {};
const routes = routesRegistry || {};

if (Object.keys(imports).length === 0) {
  fail('importmap.json has no imports');
}

if (Object.keys(routes).length === 0) {
  fail('routes.registry.json has no routes');
}

if (fs.existsSync(assembleConfigPath)) {
  const assembleConfig = readJson(assembleConfigPath);
  const expectedModules = Object.keys(assembleConfig?.frontendModules || {});
  const missingModules = expectedModules.filter((name) => !imports[name]);

  if (missingModules.length > 0) {
    fail(`${missingModules.length} expected module(s) missing from importmap.json:`);
    for (const name of missingModules) {
      logFail(`  - ${name}`);
    }
  } else {
    logInfo(`All ${expectedModules.length} expected module(s) are present in importmap.json`);
  }
} else {
  logWarn(`Assemble config not found: ${assembleConfigPath}; skipping expected-module validation`);
}

for (const [moduleName, bundlePath] of Object.entries(imports)) {
  if (typeof bundlePath !== 'string' || bundlePath.length === 0) {
    fail(`${moduleName}: importmap entry is empty`);
    continue;
  }

  if (/^https?:\/\//.test(bundlePath)) {
    continue;
  }

  const relativePath = bundlePath.replace(/^\.\//, '');
  const resolvedPath = path.resolve(outDir, relativePath);
  const outputRoot = path.resolve(outDir);

  if (!resolvedPath.startsWith(outputRoot + path.sep) && resolvedPath !== outputRoot) {
    fail(`${moduleName}: importmap path escapes output directory: ${bundlePath}`);
    continue;
  }

  if (!fs.existsSync(resolvedPath)) {
    fail(`${moduleName}: importmap target does not exist: ${bundlePath}`);
  }
}

const modulesWithoutRoutes = Object.keys(imports).filter((name) => !routes[name]);
if (modulesWithoutRoutes.length > 0) {
  logWarn(`${modulesWithoutRoutes.length} module(s) have no route registration:`);
  for (const name of modulesWithoutRoutes) {
    logWarn(`  - ${name}`);
  }
}

if (failed) {
  process.exit(1);
}

logInfo('SPA artifact is valid');
