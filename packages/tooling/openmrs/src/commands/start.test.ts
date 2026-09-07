import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { StartArgs } from './start';

const nodeRequire = createRequire(import.meta.url);
// Exercise the actual CommonJS emitted by this CLI's compiler, not Vitest's
// ESM interop. No browser, network request or listening socket is opened.
const compiledStart = ts.transpileModule(readFileSync(new URL('./start.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

async function createRuntime(open: boolean, importFailure = false) {
  const openBrowser = vi.fn().mockResolvedValue(undefined);
  const logWarn = vi.fn();
  const listen = vi.fn();
  const app = { get: vi.fn(), use: vi.fn(), listen };
  const namespace = nodeRequire('open');
  expect(typeof namespace).toBe('object');
  expect(typeof namespace.default).toBe('function');
  const requireModule = Object.assign(
    vi.fn((id: string) => {
      if (id === 'open') {
        if (importFailure) throw new Error('Synthetic import failure');
        return { ...namespace, default: openBrowser };
      }
      if (id === 'node:fs') return { existsSync: () => false, readFileSync: () => '<html></html>' };
      if (id === 'express') return Object.assign(() => app, { static: vi.fn() });
      if (id === 'http-proxy-middleware') return { createProxyMiddleware: vi.fn() };
      if (id === '../../spa-static-options') {
        return { createSpaStaticOptions: vi.fn(), isSpaIndexRequestPath: vi.fn() };
      }
      if (id === '../utils') {
        return {
          logInfo: vi.fn(),
          logWarn,
          removeTrailingSlash: (value: string) => value.replace(/\/+$/, ''),
          shouldAllowSelfSignedTls: () => false,
        };
      }
      return nodeRequire(id);
    }),
    { resolve: nodeRequire.resolve },
  );
  const exports: { runStart?: (args: StartArgs) => Promise<void> } = {};
  runInNewContext(compiledStart, {
    exports,
    require: requireModule,
    process: { cwd: () => '/synthetic-cli-fixture', env: {} },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  });
  const startupErrors: unknown[] = [];
  void exports
    .runStart({
      backend: 'https://synthetic.invalid',
      host: 'localhost',
      port: 8080,
      open,
      addCookie: '',
    })
    .catch((error) => startupErrors.push(error));
  await vi.waitFor(() => expect(listen).toHaveBeenCalledOnce());
  expect(startupErrors).toEqual([]);
  logWarn.mockClear();
  const onListening = listen.mock.calls[0][2] as () => void;
  return { openBrowser, logWarn, requireModule, onListening };
}

describe('CommonJS CLI browser launch', () => {
  it('calls the installed ESM module default export after listening', async () => {
    const runtime = await createRuntime(true);
    expect(() => runtime.onListening()).not.toThrow();
    await vi.waitFor(() =>
      expect(runtime.openBrowser).toHaveBeenCalledWith('http://localhost:8080/openmrs/spa', { wait: false }),
    );
    expect(runtime.openBrowser).toHaveBeenCalledOnce();
    expect(runtime.logWarn).not.toHaveBeenCalled();
  });

  it('does not import or launch open when the flag is disabled', async () => {
    const runtime = await createRuntime(false);
    runtime.onListening();
    expect(runtime.requireModule).not.toHaveBeenCalledWith('open');
    expect(runtime.openBrowser).not.toHaveBeenCalled();
  });

  it('keeps serving and reports a safe warning when launching the browser fails', async () => {
    const runtime = await createRuntime(true);
    runtime.openBrowser.mockRejectedValueOnce(new Error('Synthetic private diagnostic'));
    expect(() => runtime.onListening()).not.toThrow();
    await vi.waitFor(() => expect(runtime.logWarn).toHaveBeenCalledOnce());
    expect(runtime.logWarn).toHaveBeenCalledWith(expect.stringContaining('Unable to open'));
    expect(runtime.logWarn.mock.calls.flat().join(' ')).not.toContain('Synthetic private diagnostic');
  });

  it('also catches module-loading failures without crashing the listening callback', async () => {
    const runtime = await createRuntime(true, true);
    expect(() => runtime.onListening()).not.toThrow();
    await vi.waitFor(() => expect(runtime.logWarn).toHaveBeenCalledOnce());
    expect(runtime.openBrowser).not.toHaveBeenCalled();
  });
});
