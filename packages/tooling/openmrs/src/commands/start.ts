import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createSpaStaticOptions, isSpaIndexRequestPath } from '../../spa-static-options';

import { logInfo, logWarn, removeTrailingSlash, shouldAllowSelfSignedTls } from '../utils';

const upstreamSpaUrl = 'https://dev3.openmrs.org/openmrs/spa';
const backendFetchTimeoutMs = Number(process.env.SIHSALUS_BACKEND_FETCH_TIMEOUT_MS) || 5000;

export interface StartArgs {
  port: number;
  host: string;
  open: boolean;
  backend: string;
  addCookie: string;
}

async function fetchBackendJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), backendFetchTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.ok) {
      return (await response.json()) as Record<string, unknown>;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logWarn(`Timed out fetching ${url} after ${backendFetchTimeoutMs}ms`);
    }
    // Backend not reachable — that's fine, we proceed with local-only
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

interface LocalDiscovery {
  importmap: { imports: Record<string, string> };
  routes: Record<string, unknown>;
  distDirs: string[];
}

function resolveEntryFile(appsDir: string, entry: { name: string }, pkg: Record<string, unknown>): string | null {
  const browserField = (pkg.browser || pkg.module || pkg.main) as string | undefined;
  if (!browserField) return null;
  const entryPath = resolve(appsDir, entry.name, browserField);
  if (!existsSync(entryPath)) return null;
  return basename(browserField);
}

function loadModuleRoutes(
  appsDir: string,
  entry: { name: string },
  pkg: Record<string, unknown>,
): Record<string, unknown> | null {
  const routesPath = resolve(appsDir, entry.name, 'src', 'routes.json');
  if (!existsSync(routesPath)) return null;
  return {
    ...JSON.parse(readFileSync(routesPath, 'utf8')),
    version: (pkg.version as string) || '0.0.0',
  };
}

/**
 * Auto-discover locally-built @sihsalus/* modules from packages/apps/,
 * eliminating the need for `yarn assemble` during development.
 */
function discoverLocalModules(rootDir: string): LocalDiscovery {
  const importmap: { imports: Record<string, string> } = { imports: {} };
  const routes: Record<string, unknown> = {};
  const distDirs: string[] = [];

  const appsDir = resolve(rootDir, 'packages', 'apps');
  if (!existsSync(appsDir)) return { importmap, routes, distDirs };

  const entries = readdirSync(appsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('esm-')) continue;

    const pkgJsonPath = resolve(appsDir, entry.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
    if (pkg.private || !(pkg.name as string)?.startsWith('@sihsalus/')) continue;

    const distDir = resolve(appsDir, entry.name, 'dist');
    if (!existsSync(distDir)) continue;

    const entryFile = resolveEntryFile(appsDir, entry, pkg);
    if (!entryFile) continue;

    importmap.imports[pkg.name as string] = `./${entryFile}`;
    distDirs.push(distDir);

    const moduleRoutes = loadModuleRoutes(appsDir, entry, pkg);
    if (moduleRoutes) routes[pkg.name as string] = moduleRoutes;

    logInfo(`  Discovered ${pkg.name} -> ${entryFile}`);
  }

  return { importmap, routes, distDirs };
}

function mergeImportmaps(
  localImportmap: { imports: Record<string, string> },
  backendImportmap: { imports?: Record<string, string> } | null,
  localBaseNames: Set<string>,
  spaDist: string,
): { imports: Record<string, string> } {
  const merged: { imports: Record<string, string> } = { imports: {} };

  if (backendImportmap?.imports) {
    let skippedCount = 0;
    let addedCount = 0;
    for (const [name, url] of Object.entries(backendImportmap.imports)) {
      const baseName = name.replace(/^@[^/]+\//, '');
      if (localBaseNames.has(baseName)) {
        skippedCount++;
        continue;
      }
      if (localImportmap.imports[name]) {
        addedCount++;
        continue;
      }
      const cleanRelUrl = url.replace(/^\.\//, '');
      const localPath = resolve(spaDist, cleanRelUrl);
      if (existsSync(localPath)) {
        merged.imports[name] = `./${cleanRelUrl}`;
        addedCount++;
      } else {
        skippedCount++;
        logWarn(`  Skip ${name}: not available locally`);
      }
    }
    logInfo(
      `Backend importmap: ${Object.keys(backendImportmap.imports).length} modules (${addedCount} available, ${skippedCount} skipped)`,
    );
  } else {
    logWarn(`Could not fetch backend importmap — using local modules only`);
  }

  for (const [name, url] of Object.entries(localImportmap.imports)) {
    merged.imports[name] = url;
  }

  return merged;
}

function mergeRoutes(
  localRoutes: Record<string, unknown>,
  backendRoutes: Record<string, unknown> | null,
  localBaseNames: Set<string>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  if (backendRoutes) {
    for (const [name, config] of Object.entries(backendRoutes)) {
      const baseName = name.replace(/^@[^/]+\//, '');
      if (!localBaseNames.has(baseName)) merged[name] = config;
    }
  }
  Object.assign(merged, localRoutes);
  return merged;
}

function rewriteLocalDevSetCookie(setCookie: Array<string>): Array<string> {
  const rewrite = (cookie: string) => cookie.replace(/;\s*Secure/gi, '');
  return setCookie.map(rewrite);
}

export async function runStart(args: StartArgs) {
  const { backend, host, port, open, addCookie } = args;
  const expressApp = express();
  const shellDist = resolve(require.resolve('@openmrs/esm-app-shell/package.json'), '..', 'dist');
  const spaDist = resolve(process.cwd(), 'dist', 'spa');
  const spaPath = '/openmrs/spa';
  const backendUrl = removeTrailingSlash(backend);
  const pageUrl = `http://${host}:${port}${spaPath}`;
  const allowSelfSignedTls = shouldAllowSelfSignedTls(backend);

  // Rewrite index.html to use local importmap and routes instead of the upstream demo shell URLs.
  // Also disable offline/service-worker to prevent stale caches during local dev.
  const indexContent = readFileSync(resolve(shellDist, 'index.html'), 'utf8')
    .replaceAll(`${upstreamSpaUrl}/importmap.json`, `${spaPath}/importmap.json`)
    .replaceAll(upstreamSpaUrl, spaPath)
    .replace(/href="\/openmrs\/spa/g, `href="${spaPath}`)
    .replace(/src="\/openmrs\/spa/g, `src="${spaPath}`)
    .replace(/offline:\s*true/g, 'offline: false');

  // Auto-discover locally-built @sihsalus/* modules directly from packages/apps/
  logInfo('Discovering local @sihsalus/* modules...');
  const discovery = discoverLocalModules(process.cwd());
  const localImportmap = discovery.importmap;

  logInfo(`Local modules: ${Object.keys(localImportmap.imports).length}`);

  // Build a set of "base names" from local modules to detect duplicates under different scopes
  // e.g. local "@sihsalus/esm-fua-app" should exclude backend "@pucp-gidis-hiisc/esm-fua-app"
  const localBaseNames = new Set(Object.keys(localImportmap.imports).map((name) => name.replace(/^@[^/]+\//, '')));

  logInfo(`Fetching backend importmap from ${backendUrl}...`);
  const backendImportmap = (await fetchBackendJson(`${backendUrl}/openmrs/spa/importmap.json`)) as {
    imports?: Record<string, string>;
  } | null;

  const mergedImportmap = mergeImportmaps(localImportmap, backendImportmap, localBaseNames, spaDist);

  const localCount = Object.keys(localImportmap.imports).length;
  const totalCount = Object.keys(mergedImportmap.imports).length;
  logInfo(`Merged importmap: ${localCount} local + ${totalCount - localCount} from backend = ${totalCount} total`);

  // Build merged routes
  const backendRoutes = (await fetchBackendJson(`${backendUrl}/openmrs/spa/routes.registry.json`)) as Record<
    string,
    unknown
  > | null;
  const mergedRoutes = mergeRoutes(discovery.routes, backendRoutes, localBaseNames);

  // Serve merged importmap and routes as JSON endpoints
  const importmapJson = JSON.stringify(mergedImportmap);
  const routesJson = JSON.stringify(mergedRoutes);

  expressApp.get(`${spaPath}/importmap.json`, (_, res) => {
    res.contentType('application/json').send(importmapJson);
  });

  expressApp.get(`${spaPath}/routes.registry.json`, (_, res) => {
    res.contentType('application/json').send(routesJson);
  });

  const shouldServeSpaIndex = (requestPath: string) => isSpaIndexRequestPath(requestPath, spaPath);

  // Serve rewritten index.html for SPA routes (before static assets)
  expressApp.get([spaPath, `${spaPath}/*`], (req, res, next) => {
    if (!shouldServeSpaIndex(req.originalUrl || req.path)) {
      return next();
    }
    res.contentType('text/html').send(indexContent);
  });

  // Serve local module dist directories (auto-discovered from packages/apps/)
  for (const distDir of discovery.distDirs) {
    expressApp.use(spaPath, express.static(distDir, createSpaStaticOptions({ index: false })));
  }

  // Fallback to dist/spa if it exists (from yarn assemble)
  if (existsSync(spaDist)) {
    expressApp.use(spaPath, express.static(spaDist, createSpaStaticOptions({ index: false })));
  }
  expressApp.use(spaPath, express.static(shellDist, createSpaStaticOptions({ index: false })));

  // Proxy all /openmrs/* API requests to the backend (except /openmrs/spa/**)
  expressApp.use(
    createProxyMiddleware((path) => path.startsWith('/openmrs') && !path.startsWith(spaPath), {
      target: backend,
      changeOrigin: true,
      secure: !allowSelfSignedTls,
      onProxyReq(proxyReq) {
        if (addCookie) {
          const origCookie = proxyReq.getHeader('cookie');
          const newCookie = `${origCookie};${addCookie}`;
          proxyReq.setHeader('cookie', newCookie);
        }
      },
      onProxyRes(proxyRes) {
        // Remove CSP headers from backend — they block browser requests
        // when serving from localhost (the backend's CSP allowlist doesn't
        // include all the origins the local dev server needs).
        if (proxyRes.headers) {
          delete proxyRes.headers['content-security-policy'];
          delete proxyRes.headers['content-security-policy-report-only'];
          const setCookie = proxyRes.headers['set-cookie'];
          if (setCookie) {
            proxyRes.headers['set-cookie'] = rewriteLocalDevSetCookie(setCookie);
          }
        }
      },
    }),
  );

  // Fallback: serve index.html only for client-side routes, never for missing assets.
  expressApp.get('/*', (req, res, next) => {
    if (!shouldServeSpaIndex(req.originalUrl || req.path)) {
      return next();
    }
    res.contentType('text/html').send(indexContent);
  });

  // Bind to 0.0.0.0 to listen on both IPv4 and IPv6, avoiding issues where
  // "localhost" resolves to only ::1 (IPv6) but the browser tries 127.0.0.1 first.
  const listenHost = host === 'localhost' ? '0.0.0.0' : host;
  expressApp.listen(port, listenHost, () => {
    logInfo(`Listening at http://localhost:${port}`);
    logInfo(`SPA available at ${pageUrl}`);

    if (open) {
      const open = require('open');

      open(pageUrl, { wait: false }).catch(() => {
        logWarn(
          `Unable to open "${pageUrl}" in browser. If you are running in a headless environment, please do not use the --open flag.`,
        );
      });
    }
  });

  return new Promise<void>(() => {});
}
