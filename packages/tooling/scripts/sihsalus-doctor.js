#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const chalk = require('chalk');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '../../..');
const prefix = chalk.cyan.bold('[sihsalus:doctor]');

const requiredEnvKeys = ['SIHSALUS_BACKEND_URL', 'SIHSALUS_AUTH_MODE', 'SIHSALUS_FHIR_BASE', 'E2E_BASE_URL'];
const optionalEnvKeys = [
  'SIHSALUS_ALLOW_SELF_SIGNED_TLS',
  'E2E_API_BASE_URL',
  'E2E_SKIP_AUTH',
  'E2E_DISABLE_WEB_SERVER',
  'E2E_USERNAME',
  'E2E_PASSWORD',
  'E2E_LOGIN_DEFAULT_LOCATION_UUID',
];
const urlEnvKeys = ['SIHSALUS_BACKEND_URL', 'SIHSALUS_FHIR_BASE', 'E2E_BASE_URL', 'E2E_API_BASE_URL'];
const sensitiveEnvPattern = /PASSWORD|SECRET|TOKEN|KEY/i;

const criticalModules = [
  '@sihsalus/esm-login-app',
  '@sihsalus/esm-primary-navigation-app',
  '@sihsalus/esm-home-app',
  '@sihsalus/esm-patient-registration-app',
  '@sihsalus/esm-patient-chart-app',
  '@sihsalus/esm-atencion-ambulatoria-app',
  '@sihsalus/esm-ficha-familiar-app',
  '@sihsalus/esm-cred-app',
  '@sihsalus/esm-odontologia-app',
  '@sihsalus/esm-care-logbook-app',
  '@sihsalus/esm-patient-vitals-app',
  '@sihsalus/esm-patient-notes-app',
];

const brandAssets = [
  'assets/favicon.ico',
  'assets/resources/favicon.ico',
  'assets/resources/login-logo.svg',
  'assets/resources/primary-logo.png',
  'assets/resources/sihsalus-horizontal.svg',
  'assets/resources/sihsalus-horizontal-white.svg',
  'assets/resources/sihsalus-vertical.svg',
];

const defaultBranding = {
  'Brand color #1': '#27348b',
  'Brand color #2': '#17205f',
  'Brand color #3': '#2c7d35',
  implementationName: 'SIHSALUS',
};

const counts = {
  pass: 0,
  warn: 0,
  fail: 0,
};

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  fail(error.message);
  printHelp();
  finish();
}

if (args.help) {
  printHelp();
  process.exit(0);
}

main().catch((error) => {
  fail(error.stack || error.message);
  finish();
});

async function main() {
  console.log(`${prefix} Running deployment readiness checks`);

  const packageJson = readJson('package.json');
  const frontendConfig = readJson('config/frontend.json');
  const assembleConfig = readJson('config/spa-assemble-config.json');
  const envFile = readEnvFile('.env');
  readEnvFile('.env.template', { template: true });

  checkTooling(packageJson);
  checkEnvironment(envFile);
  checkBranding(frontendConfig);
  checkAssembleConfig(assembleConfig);
  checkAssets();
  await checkNetwork(envFile);

  finish();
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    skipNetwork: process.env.SIHSALUS_DOCTOR_SKIP_NETWORK === 'true',
    timeoutMs: Number(process.env.SIHSALUS_DOCTOR_TIMEOUT_MS || 5000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--skip-network' || arg === '--offline') {
      parsed.skipNetwork = true;
    } else if (arg === '--timeout') {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        parsed.timeoutMs = value;
        index += 1;
      } else {
        throw new Error('--timeout expects a positive number of milliseconds');
      }
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`${prefix} Usage: yarn sihsalus:doctor [options]`);
  console.log('');
  console.log('Options:');
  console.log('  --skip-network, --offline  Skip backend and FHIR reachability checks');
  console.log('  --timeout <ms>             Network timeout in milliseconds (default: 5000)');
  console.log('  -h, --help                 Show this help');
}

function checkTooling(packageJson) {
  section('Tooling');
  if (!packageJson) {
    return;
  }

  const nodeEngine = packageJson.engines?.node;
  if (!nodeEngine) {
    warn('package.json does not declare engines.node');
  } else {
    const requiredMajor = Number(nodeEngine.match(/>=\s*(\d+)/)?.[1]);
    const currentMajor = Number(process.versions.node.split('.')[0]);
    if (Number.isFinite(requiredMajor) && currentMajor < requiredMajor) {
      fail(`Node ${process.versions.node} does not satisfy ${nodeEngine}`);
    } else {
      pass(`Node ${process.versions.node} satisfies ${nodeEngine}`);
    }
  }

  if (packageJson.packageManager?.startsWith('yarn@')) {
    pass(`packageManager is ${packageJson.packageManager}`);
  } else {
    warn('packageManager is not pinned to yarn');
  }

  exists('.yarnrc.yml', 'Yarn config exists');
  exists('yarn.lock', 'Yarn lockfile exists');
  exists('turbo.json', 'Turbo config exists');
}

function checkEnvironment(envFile) {
  section('Environment');

  if (!envFile.exists) {
    warn('.env was not found; copy .env.template before running locally');
  } else {
    pass('.env exists');
  }

  for (const key of requiredEnvKeys) {
    const value = getEnvValue(envFile.values, key);
    if (!value) {
      fail(`${key} is required`);
      continue;
    }
    pass(`${key} is configured${sensitiveEnvPattern.test(key) ? '' : ` (${describeValue(key, value)})`}`);
  }

  for (const key of optionalEnvKeys) {
    const value = getEnvValue(envFile.values, key);
    if (!value) {
      warn(`${key} is not configured`);
    }
  }

  for (const key of urlEnvKeys) {
    const value = getEnvValue(envFile.values, key);
    if (!value) {
      continue;
    }
    if (isValidUrl(value)) {
      pass(`${key} is a valid URL`);
    } else {
      fail(`${key} is not a valid URL`);
    }
  }

  const authMode = getEnvValue(envFile.values, 'SIHSALUS_AUTH_MODE');
  if (authMode && !['openmrs', 'keycloak'].includes(authMode)) {
    fail(`SIHSALUS_AUTH_MODE must be "openmrs" or "keycloak"; got "${authMode}"`);
  }
}

function checkBranding(frontendConfig) {
  section('Branding');
  if (!frontendConfig) {
    return;
  }

  const configuredStyleguide = frontendConfig['@openmrs/esm-styleguide'];
  const styleguide = { ...defaultBranding, ...(configuredStyleguide ?? {}) };
  if (!configuredStyleguide) {
    pass('Using SIHSALUS branding defaults from esm-styleguide');
  }

  for (const key of ['Brand color #1', 'Brand color #2', 'Brand color #3']) {
    const value = styleguide[key];
    if (!value) {
      fail(`${key} is missing`);
    } else if (!/^#[0-9a-f]{6}$/i.test(value)) {
      fail(`${key} must be a 6-digit hex color`);
    } else {
      pass(`${key} is configured (${value})`);
    }
  }

  if (!styleguide.implementationName) {
    fail('implementationName is missing');
  } else if (styleguide.implementationName === 'Clinic') {
    warn('implementationName is still the generic "Clinic" label');
  } else {
    pass(`implementationName is ${styleguide.implementationName}`);
  }
}

function checkAssembleConfig(assembleConfig) {
  section('SPA assemble config');
  if (!assembleConfig) {
    return;
  }

  const frontendModules = assembleConfig.frontendModules || {};
  const moduleCount = Object.keys(frontendModules).length;
  if (moduleCount === 0) {
    fail('config/spa-assemble-config.json has no frontendModules');
  } else {
    pass(`${moduleCount} frontend modules configured`);
  }

  for (const moduleName of criticalModules) {
    if (frontendModules[moduleName]) {
      pass(`${moduleName} is assembled`);
    } else {
      fail(`${moduleName} is missing from spa-assemble-config.json`);
    }
  }
}

function checkAssets() {
  section('Brand assets');
  for (const asset of brandAssets) {
    const assetPath = path.join(repoRoot, asset);
    if (!fs.existsSync(assetPath)) {
      fail(`${asset} is missing`);
      continue;
    }
    if (fs.statSync(assetPath).size === 0) {
      fail(`${asset} is empty`);
      continue;
    }
    pass(`${asset} exists`);
  }
}

async function checkNetwork(envFile) {
  section('Backend reachability');
  if (args.skipNetwork) {
    warn('Network checks skipped');
    return;
  }

  const backendUrl = getEnvValue(envFile.values, 'SIHSALUS_BACKEND_URL');
  const fhirUrl = getEnvValue(envFile.values, 'SIHSALUS_FHIR_BASE');
  const allowSelfSigned = getEnvValue(envFile.values, 'SIHSALUS_ALLOW_SELF_SIGNED_TLS') === 'true';
  const authHeaders = getBasicAuthHeaders(envFile.values);

  if (backendUrl && isValidUrl(backendUrl)) {
    const sessionUrl = appendUrlPath(normalizeOpenmrsBase(backendUrl), '/ws/rest/v1/session');
    await checkOpenmrsSession(sessionUrl, { allowSelfSigned, authHeaders });
  }

  if (fhirUrl && isValidUrl(fhirUrl)) {
    await checkFhirMetadata(fhirUrl, { allowSelfSigned, authHeaders });
  }
}

async function checkOpenmrsSession(url, options) {
  const result = await requestUrl(url, {
    allowSelfSigned: options.allowSelfSigned,
    timeoutMs: args.timeoutMs,
  });

  if (!result.ok) {
    fail(`OpenMRS session endpoint is not reachable (${result.error.message})`);
    return;
  }

  if (result.status >= 200 && result.status < 400) {
    pass(`OpenMRS session endpoint is reachable (${result.status})`);
  } else {
    fail(`OpenMRS session endpoint returned HTTP ${result.status}`);
    return;
  }

  if (!options.authHeaders) {
    warn('OpenMRS authenticated session check skipped; configure E2E_USERNAME and E2E_PASSWORD');
    return;
  }

  const authResult = await requestUrl(url, {
    allowSelfSigned: options.allowSelfSigned,
    headers: options.authHeaders,
    timeoutMs: args.timeoutMs,
  });

  if (!authResult.ok) {
    fail(`OpenMRS authenticated session check failed (${authResult.error.message})`);
    return;
  }

  if (authResult.status === 401 || authResult.status === 403) {
    fail(`OpenMRS rejected configured credentials (${authResult.status})`);
    return;
  }

  if (authResult.status < 200 || authResult.status >= 300) {
    fail(`OpenMRS authenticated session returned HTTP ${authResult.status}`);
    return;
  }

  const session = parseJsonBody(authResult.body);
  if (!session) {
    fail('OpenMRS authenticated session did not return valid JSON');
    return;
  }

  if (session.authenticated === true) {
    pass('OpenMRS authentication works with configured credentials');
  } else {
    fail('OpenMRS session responded but did not authenticate configured credentials');
  }
}

async function checkFhirMetadata(rawUrl, options) {
  const metadataUrl = getFhirMetadataUrl(rawUrl);
  const requestOptions = {
    allowSelfSigned: options.allowSelfSigned,
    headers: {
      accept: 'application/fhir+json, application/json',
      ...(options.authHeaders || {}),
    },
    timeoutMs: args.timeoutMs,
  };

  const result = await requestUrl(metadataUrl, requestOptions);

  if (!result.ok) {
    fail(`FHIR metadata endpoint is not reachable (${result.error.message})`);
    return;
  }

  if ((result.status === 401 || result.status === 403) && !options.authHeaders) {
    warn(
      `FHIR metadata endpoint requires auth (${result.status}); configure E2E_USERNAME and E2E_PASSWORD`,
    );
    return;
  }

  if (result.status === 401 || result.status === 403) {
    fail(`FHIR metadata endpoint rejected configured credentials (${result.status})`);
    return;
  }

  if (result.status < 200 || result.status >= 300) {
    fail(`FHIR metadata endpoint returned HTTP ${result.status}`);
    return;
  }

  const metadata = parseJsonBody(result.body);
  if (!metadata) {
    fail('FHIR metadata endpoint did not return valid JSON');
    return;
  }

  if (metadata.resourceType === 'CapabilityStatement') {
    pass(`FHIR R4 metadata is valid (${metadata.resourceType})`);
  } else {
    fail(`FHIR metadata returned unexpected resourceType "${metadata.resourceType || 'missing'}"`);
  }
}

function requestUrl(url, options) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const requestOptions = {
      method: 'GET',
      timeout: options.timeoutMs,
      headers: {
        'user-agent': 'sihsalus-doctor',
        ...(options.headers || {}),
      },
    };

    if (parsedUrl.protocol === 'https:') {
      requestOptions.rejectUnauthorized = !options.allowSelfSigned;
    }

    const request = client.request(parsedUrl, requestOptions, (response) => {
      const chunks = [];
      let bodyBytes = 0;
      response.on('data', (chunk) => {
        bodyBytes += chunk.length;
        if (bodyBytes <= 1024 * 1024) {
          chunks.push(chunk);
        }
      });
      response.on('end', () => {
        resolve({
          ok: true,
          status: response.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`timeout after ${options.timeoutMs}ms`));
    });
    request.on('error', (error) => {
      resolve({
        ok: false,
        error,
      });
    });
    request.end();
  });
}

function getBasicAuthHeaders(fileValues) {
  const username = getEnvValue(fileValues, 'E2E_USERNAME');
  const password = getEnvValue(fileValues, 'E2E_PASSWORD');
  if (!username || !password) {
    return null;
  }

  return {
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
  };
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function getFhirMetadataUrl(rawUrl) {
  const url = new URL(rawUrl);
  const pathname = url.pathname.replace(/\/+$/, '');
  if (!pathname.endsWith('/metadata')) {
    url.pathname = `${pathname}/metadata`;
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

function normalizeOpenmrsBase(rawUrl) {
  const url = new URL(rawUrl);
  let pathname = url.pathname.replace(/\/+$/, '');
  if (!pathname.endsWith('/openmrs')) {
    pathname = `${pathname}/openmrs`;
  }
  url.pathname = pathname.replace(/\/{2,}/g, '/');
  url.search = '';
  url.hash = '';
  return url;
}

function appendUrlPath(baseUrl, suffix) {
  const url = new URL(baseUrl.toString());
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
  return url.toString();
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    pass(`${relativePath} is valid JSON`);
    return value;
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return null;
  }
}

function readEnvFile(relativePath, options = {}) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    if (options.template) {
      warn(`${relativePath} was not found`);
    }
    return {
      exists: false,
      values: {},
    };
  }

  try {
    const values = dotenv.parse(fs.readFileSync(filePath));
    if (options.template) {
      pass(`${relativePath} exists`);
    }
    return {
      exists: true,
      values,
    };
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return {
      exists: false,
      values: {},
    };
  }
}

function getEnvValue(fileValues, key) {
  return process.env[key] || fileValues[key];
}

function exists(relativePath, message) {
  const filePath = path.join(repoRoot, relativePath);
  if (fs.existsSync(filePath)) {
    pass(message);
  } else {
    fail(`${relativePath} is missing`);
  }
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function describeValue(key, value) {
  if (sensitiveEnvPattern.test(key)) {
    return 'configured';
  }
  if (!isValidUrl(value)) {
    return value;
  }

  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

function section(title) {
  console.log(`\n${chalk.bold(title)}`);
}

function pass(message) {
  counts.pass += 1;
  console.log(`${chalk.green('PASS')} ${message}`);
}

function warn(message) {
  counts.warn += 1;
  console.log(`${chalk.yellow('WARN')} ${message}`);
}

function fail(message) {
  counts.fail += 1;
  console.error(`${chalk.red('FAIL')} ${message}`);
}

function finish() {
  console.log('');
  const summary = `${counts.pass} passed, ${counts.warn} warning(s), ${counts.fail} failed`;
  if (counts.fail > 0) {
    console.error(`${prefix} ${chalk.red(summary)}`);
    process.exit(1);
  }

  console.log(`${prefix} ${chalk.green(summary)}`);
}
