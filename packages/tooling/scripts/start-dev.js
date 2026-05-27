#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const { existsSync, readFileSync, statSync } = require('fs');
const net = require('net');
const { extname, join, resolve } = require('path');

const envPath = resolve(process.cwd(), '.env');
const hadBackendBeforeDotenv = Boolean(process.env.SIHSALUS_BACKEND_URL);
const dotenvResult = require('dotenv').config({ path: envPath, quiet: true });

const chalk = require('chalk');
const logInfo = (msg) => console.log(`${chalk.green.bold('[start-dev]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[start-dev]')} ${chalk.yellow(msg)}`);
const logFail = (msg) => console.error(`${chalk.red.bold('[start-dev]')} ${chalk.red(msg)}`);

const defaultBackend = 'http://gidis-hsc-dev.inf.pucp.edu.pe';
const backend = process.env.SIHSALUS_BACKEND_URL || defaultBackend;
const backendSource = hadBackendBeforeDotenv ? 'shell' : dotenvResult.parsed?.SIHSALUS_BACKEND_URL ? '.env' : 'default';
const requireBackendUrl = process.env.SIHSALUS_REQUIRE_BACKEND_URL === 'true';
const authMode = process.env.SIHSALUS_AUTH_MODE || 'openmrs';
const fhirBase = process.env.SIHSALUS_FHIR_BASE || `${backend}/openmrs/ws/fhir2/R4`;
const proxyPort = Number(process.env.SIHSALUS_PORT) || 8080;
const allowSelfSignedTls = process.env.SIHSALUS_ALLOW_SELF_SIGNED_TLS === 'true';

if (allowSelfSignedTls) {
  // Local dev against PUCP QA/dev backends may use certificates that are not
  // trusted by the host OS. The OpenMRS CLI proxy handles this via `secure:false`,
  // but the session shortcut below uses Node fetch directly.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// SIHSALUS_DEV_APPS=esm-login-app,esm-home-app  → hot-reload those apps
// Unset → serve pre-assembled importmap (no recompilation, just shell + proxy)
const devAppsEnv = process.env.SIHSALUS_DEV_APPS;

const assembledImportmap = resolve(__dirname, '..', '..', '..', 'dist', 'spa', 'importmap.json');
const assembledRoutes = resolve(__dirname, '..', '..', '..', 'dist', 'spa', 'routes.registry.json');
const distSpa = resolve(__dirname, '..', '..', '..', 'dist', 'spa');
const frontendConfig = resolve(__dirname, '..', '..', '..', 'config', 'frontend.json');
const spaPath = '/openmrs/spa';
const sessionPath = '/openmrs/ws/rest/v1/session';
const sessionFallbackTimeoutMs = Number(process.env.SIHSALUS_SESSION_FALLBACK_TIMEOUT_MS) || 3000;

function getBackendSessionUrl() {
  return `${backend.replace(/\/+$/, '').replace(/\/openmrs$/, '')}${sessionPath}`;
}

function logStartupSummary({ mode, apps = [] }) {
  console.log();
  console.log(chalk.cyan.bold('SIH Salus local frontend'));
  logInfo(`${chalk.bold('Backend')} ${chalk.cyan.underline(backend)} ${chalk.dim(`(${backendSource})`)}`);
  logInfo(`${chalk.bold('FHIR R4')} ${chalk.cyan.underline(fhirBase)}`);
  logInfo(`${chalk.bold('Auth')} ${authMode}`);
  logInfo(`${chalk.bold('Mode')} ${mode}`);
  logInfo(`${chalk.bold('Local SPA')} ${chalk.cyan.underline(`http://localhost:${proxyPort}${spaPath}`)}`);

  if (apps.length > 0) {
    logInfo(`${chalk.bold('Hot reload apps')} ${apps.join(', ')}`);
  } else {
    logInfo(`${chalk.bold('Hot reload apps')} none ${chalk.dim('(serving pre-assembled SPA)')}`);
  }

  if (backendSource === 'default') {
    logWarn(`SIHSALUS_BACKEND_URL not set, using default: ${backend}`);
  }
  if (allowSelfSignedTls) {
    logWarn('SIHSALUS_ALLOW_SELF_SIGNED_TLS=true; backend TLS certificate verification is disabled for local dev.');
  }
  console.log();
}

if (requireBackendUrl && backendSource === 'default') {
  logFail('SIHSALUS_BACKEND_URL is required because SIHSALUS_REQUIRE_BACKEND_URL=true.');
  logFail('  Set SIHSALUS_BACKEND_URL in the shell or in .env.');
  process.exit(1);
}

function rewriteLocalDevSetCookie(setCookie) {
  if (!setCookie) return setCookie;
  const rewrite = (cookie) => cookie.replace(/;\s*Secure/gi, '');
  return Array.isArray(setCookie) ? setCookie.map(rewrite) : rewrite(setCookie);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function startCli(args) {
  const openmrsBin = ensureOpenmrsCli();
  const fullArgs = [openmrsBin, 'develop', '--backend', backend, ...args];

  const child = spawn('node', ['--disable-warning=DEP0060', ...fullArgs], { stdio: 'inherit' });

  child.on('exit', (code) => process.exit(code ?? 1));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));

  return child;
}

function withSharedDependencies(args) {
  const sharedDependencies = [
    '@openmrs/esm-styleguide',
    'single-spa',
    'single-spa-react',
    '@openmrs/esm-config',
    '@openmrs/esm-extensions',
    '@openmrs/esm-navigation',
    '@openmrs/esm-offline',
    '@openmrs/esm-react-utils',
    '@openmrs/esm-state',
  ];

  return [...args, ...sharedDependencies.flatMap((dependency) => ['--shared-dependencies', dependency])];
}

function ensureOpenmrsCli() {
  // NOSONAR: this resolver intentionally returns the same CLI path after ensuring it exists.
  const workspaceRoot = resolve(__dirname, '..', '..', '..');
  const rspackConfigEntry = resolve(workspaceRoot, 'node_modules', '@openmrs', 'rspack-config', 'dist', 'index.js');
  const openmrsBin = resolve(workspaceRoot, 'node_modules', 'openmrs', 'dist', 'cli.js');

  if (!existsSync(rspackConfigEntry)) {
    logWarn('@openmrs/rspack-config no encontrado en dist. Compilando workspace "@openmrs/rspack-config"...');
    runWorkspaceBuild('@openmrs/rspack-config', workspaceRoot);
  }

  if (existsSync(openmrsBin)) {
    return openmrsBin;
  }

  logWarn('openmrs CLI no encontrado en node_modules/openmrs/dist/cli.js. Compilando workspace "openmrs"...');
  runWorkspaceBuild('openmrs', workspaceRoot);

  if (!existsSync(openmrsBin)) {
    logFail('La compilación terminó, pero sigue faltando node_modules/openmrs/dist/cli.js.');
    process.exit(1);
  }

  return openmrsBin;
}

function runWorkspaceBuild(workspaceName, workspaceRoot) {
  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const build = spawnSync(yarnCmd, ['workspace', workspaceName, 'build'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });

  if (build.error || build.status !== 0) {
    logFail(`No se pudo compilar el workspace "${workspaceName}".`);
    process.exit(build.status || 1);
  }
}

function createInMemoryRateLimit({ windowMs, max }) {
  const requestsByIp = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = requestsByIp.get(key);

    if (!current || current.resetAt <= now) {
      requestsByIp.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('retry-after', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).send('Too many requests');
    }

    return next();
  };
}

/**
 * Start a reverse proxy on port 8080 that:
 * 1. Serves pre-built bundles and chunks from dist/spa/ for /openmrs/spa/ paths
 * 2. Proxies everything else to the openmrs CLI on an internal port
 *
 * This ensures webpack lazy chunks (translations, vendor splits) resolve correctly
 * because they're served from the same origin (/openmrs/spa/) as the SPA shell,
 * which is where publicPath:'auto' points at runtime.
 */
async function startWithProxy(cliArgs) {
  const express = require('express');
  const { createProxyMiddleware } = require('http-proxy-middleware');

  const configuredCliPort = Number(process.env.SIHSALUS_INTERNAL_CLI_PORT);
  const cliPort =
    Number.isFinite(configuredCliPort) && configuredCliPort > 0 ? configuredCliPort : await findFreePort();

  // Files managed by the openmrs CLI — always proxy these to the CLI
  const cliManagedPaths = new Set(['/importmap.json', '/routes.registry.json', '/routes.json']);

  const app = express();
  const staticHandler = express.static(distSpa);
  const spaIndexHtml = readFileSync(join(distSpa, 'index.html'), 'utf8');
  const spaIndexRateLimit = createInMemoryRateLimit({
    windowMs: Number(process.env.SIHSALUS_SPA_RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.SIHSALUS_SPA_RATE_LIMIT_MAX) || 300,
  });

  app.get(sessionPath, async (req, res) => {
    const authorization = req.get('authorization');
    const cookie = req.get('cookie') || '';

    if (!authorization && !cookie) {
      res.status(200).json({ authenticated: false, sessionId: '' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), sessionFallbackTimeoutMs);

    try {
      const backendResponse = await fetch(getBackendSessionUrl(), {
        headers: {
          accept: req.get('accept') || 'application/json',
          ...(authorization ? { authorization } : {}),
          cookie,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      res.status(backendResponse.status);
      const contentType = backendResponse.headers.get('content-type');
      if (contentType) {
        res.type(contentType);
      }
      const setCookie = backendResponse.headers.get('set-cookie');
      if (setCookie) {
        res.setHeader('set-cookie', rewriteLocalDevSetCookie(setCookie));
      }
      res.send(await backendResponse.text());
    } catch (error) {
      clearTimeout(timeout);
      const isTimeout = error?.name === 'AbortError';
      const status = isTimeout ? 504 : 502;
      logWarn(
        `Backend login session ${isTimeout ? `did not respond within ${sessionFallbackTimeoutMs}ms` : 'failed'}; returning ${status}.`,
      );
      res.status(status).json({
        error: 'backend_session_unavailable',
        message: isTimeout
          ? `Backend session endpoint did not respond within ${sessionFallbackTimeoutMs}ms.`
          : 'Backend session endpoint failed.',
      });
    }
  });

  // Serve pre-built assets from dist/spa/, skip CLI-managed files
  app.use(spaPath, (req, res, next) => {
    if (cliManagedPaths.has(req.path)) {
      return next();
    }
    staticHandler(req, res, next);
  });

  app.get(`${spaPath}/*`, spaIndexRateLimit, (req, res, next) => {
    if (cliManagedPaths.has(req.path) || extname(req.path)) {
      return next();
    }
    res.type('html').send(spaIndexHtml);
  });

  // Proxy everything else to the openmrs CLI (importmap, index.html, API, etc.)
  app.use(
    createProxyMiddleware({
      target: `http://localhost:${cliPort}`,
      ws: true,
      changeOrigin: true,
      logLevel: 'warn',
    }),
  );

  const server = app.listen(proxyPort, '127.0.0.1', () => {
    logInfo(`Proxy :${proxyPort} → internal CLI :${cliPort}`);
    logInfo(`SPA → ${chalk.cyan.underline(`http://localhost:${proxyPort}${spaPath}`)}`);
    startCli(['--port', String(cliPort), '--open', 'false', ...cliArgs]);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logFail(`Port ${proxyPort} is already in use.`);
      logFail(`  Stop the process using it or run with SIHSALUS_PORT=<free-port>.`);
    } else {
      logFail(`Could not start local proxy on port ${proxyPort}: ${error.message}`);
    }
    process.exit(1);
  });
}

if (devAppsEnv) {
  const apps = devAppsEnv
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const sourcesArgs = apps.flatMap((app) => {
    const dir = resolve(__dirname, '..', '..', 'apps', app);
    if (!existsSync(dir)) {
      logFail(`App not found: ${dir}`);
      process.exit(1);
    }
    return ['--sources', dir];
  });
  logStartupSummary({ mode: 'hot reload', apps });

  if (existsSync(assembledImportmap) && existsSync(assembledRoutes)) {
    const importmapAge = Date.now() - statSync(assembledImportmap).mtimeMs;
    const hoursOld = Math.floor(importmapAge / 3_600_000);
    if (hoursOld >= 24) {
      logWarn(`Assembled importmap is ${hoursOld}h old. Consider running: yarn assemble`);
    }

    // Use reverse proxy: dist/spa bundles + chunks served from same origin
    startWithProxy(
      withSharedDependencies([
        '--importmap',
        assembledImportmap,
        '--routes',
        assembledRoutes,
        '--config-file',
        frontendConfig,
        ...sourcesArgs,
      ]),
    );
  } else {
    logWarn('No assembled importmap found. Only apps in SIHSALUS_DEV_APPS will be available.');
    logWarn('For all apps: yarn assemble');
    startCli(
      withSharedDependencies([
        '--importmap',
        '{"imports":{}}',
        '--routes',
        '{}',
        '--config-file',
        frontendConfig,
        ...sourcesArgs,
      ]),
    );
  }
} else {
  // No apps to hot-reload: serve the pre-assembled SPA purely via proxy + static files
  if (!existsSync(assembledImportmap)) {
    logFail('No assembled importmap found.');
    logFail('  Run: yarn assemble   (builds the importmap from local packages)');
    logFail('  Or set SIHSALUS_DEV_APPS=esm-login-app,... for hot-reload');
    process.exit(1);
  }
  logStartupSummary({ mode: 'pre-assembled SPA' });
  logInfo('Serving pre-assembled SPA (no hot-reload). Set SIHSALUS_DEV_APPS for development.');
  // Avoid the CLI defaulting to "." as a dev source. In pre-assembled mode the
  // proxy serves all application bundles from dist/spa, so no dynamic dev-server
  // import should be added to the import map.
  const noDevSourcesPattern = '__sihsalus_no_dev_sources__';

  startWithProxy(
    withSharedDependencies([
      '--importmap',
      assembledImportmap,
      '--routes',
      assembledRoutes,
      '--config-file',
      frontendConfig,
      '--sources',
      noDevSourcesPattern,
    ]),
  );
}
