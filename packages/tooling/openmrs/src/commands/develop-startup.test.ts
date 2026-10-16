import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DevelopArgs } from './develop';

const nodeRequire = createRequire(import.meta.url);
// Match the emitted CommonJS contract used by start.test.ts, with real shell
// files and replaced server side effects. No socket, browser or backend starts.
const compiledDevelop = ts.transpileModule(readFileSync(new URL('./develop.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createRuntime(supportOffline: boolean, withWorker: boolean) {
  const shell = mkdtempSync(join(tmpdir(), 'openmrs-develop-shell-'));
  directories.push(shell);
  mkdirSync(join(shell, 'dist'));
  writeFileSync(join(shell, 'package.json'), '{"name":"@openmrs/esm-app-shell","version":"10.0.0"}');
  writeFileSync(join(shell, 'dist/index.html'), '<html><script>initializeSpa({});</script></html>');
  if (withWorker) {
    writeFileSync(join(shell, 'dist/service-worker.js'), 'const scope = "https://dev3.openmrs.org/openmrs/spa/";');
  }

  let listening: () => void;
  let failed: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    listening = resolve;
    failed = reject;
  });
  const app = { get: vi.fn(), use: vi.fn(), listen: vi.fn(() => listening()) };
  const middleware = vi.fn();
  const requireModule = Object.assign(
    (id: string) => {
      if (id === 'express') return Object.assign(() => app, { static: vi.fn(() => middleware) });
      if (id === 'express-rate-limit') return { rateLimit: () => middleware };
      if (id === 'http-proxy-middleware') return { createProxyMiddleware: () => middleware };
      if (id === 'node-watch') return vi.fn();
      if (id === '../utils') {
        return {
          logInfo: vi.fn(),
          logWarn: vi.fn(),
          removeTrailingSlash: (value: string) => value.replace(/\/+$/, ''),
          shouldAllowSelfSignedTls: () => false,
        };
      }
      if (id === './develop-path-filter') return { shouldProxyApiRequest: vi.fn() };
      if (id === './develop-rate-limit') {
        return {
          createInMemoryRateLimit: () => middleware,
          readRateLimitEnv: (_name: string, fallback: number) => fallback,
          readPositiveRateLimitEnv: (_name: string, fallback: number) => fallback,
        };
      }
      return nodeRequire(id);
    },
    {
      resolve: (id: string) =>
        id === '@openmrs/esm-app-shell/package.json' ? join(shell, 'package.json') : nodeRequire.resolve(id),
    },
  );
  const exports: { runDevelop?: (args: DevelopArgs) => Promise<void> } = {};
  runInNewContext(compiledDevelop, { exports, require: requireModule, process });
  void exports
    .runDevelop({
      backend: 'https://synthetic.invalid',
      host: 'localhost',
      port: 8080,
      open: false,
      importmap: { type: 'inline', value: '{"imports":{}}' },
      routes: { type: 'inline', value: '{}' },
      watchedRoutesPaths: {},
      spaPath: '/openmrs/spa/',
      apiUrl: '/openmrs/',
      configUrls: [],
      configFiles: [],
      addCookie: '',
      supportOffline,
    })
    .catch(failed);
  return { app, ready };
}

describe('CommonJS develop service-worker startup', () => {
  it('starts without a packaged worker when offline support is disabled', async () => {
    const runtime = createRuntime(false, false);
    await expect(runtime.ready).resolves.toBeUndefined();
    expect(runtime.app.listen).toHaveBeenCalledWith(8080, 'localhost', expect.any(Function));
    expect(runtime.app.get.mock.calls.some(([path]) => path === '/openmrs/spa/service-worker.js')).toBe(false);
  });

  it('serves the rewritten worker when offline support is enabled', async () => {
    const runtime = createRuntime(true, true);
    await expect(runtime.ready).resolves.toBeUndefined();
    const route = runtime.app.get.mock.calls.find(([path]) => path === '/openmrs/spa/service-worker.js');
    expect(route).toBeDefined();
    const response = { contentType: vi.fn(), send: vi.fn() };
    response.contentType.mockReturnValue(response);
    route[2]({}, response);
    expect(response.contentType).toHaveBeenCalledWith('js');
    expect(response.send).toHaveBeenCalledWith('const scope = "/openmrs/spa";');
  });

  it('fails before listening when offline support requires a missing worker', async () => {
    const runtime = createRuntime(true, false);
    await expect(runtime.ready).rejects.toMatchObject({ code: 'ENOENT' });
    expect(runtime.app.listen).not.toHaveBeenCalled();
  });
});
