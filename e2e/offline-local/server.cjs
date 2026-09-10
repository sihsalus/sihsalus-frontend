const { createServer } = require('node:http');
const { mkdtempSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const { buildAppShell } = require('../../packages/tooling/scripts/build-app-shell');
const root = path.resolve(__dirname, '../..');
const output = mkdtempSync(path.join(tmpdir(), 'sihsalus-offline-local-'));
// These values describe this loopback synthetic server, never a deployed backend.
Object.assign(process.env, {
  OMRS_OFFLINE: 'enable',
  OMRS_PUBLIC_PATH: '/openmrs/spa',
  OMRS_API_URL: '/openmrs',
  OMRS_SERVICE_WORKER_SRC: path.join(root, 'packages/tooling/app-shell/service-worker.ts'),
  OMRS_REPOSITORY_ROOT: root,
  NODE_ENV: 'production',
});
async function start() {
  // Keep actionable build failures visible; long CSS warnings can exhaust pipe buffers on exit.
  const messages = [];
  const originalLog = console.log;
  console.log = (...args) => messages.push(args.join(' '));
  try {
    await buildAppShell(output);
  } catch (error) {
    for (const message of messages) {
      console.error(
        message
          .split('\n\n')
          .filter((block) => block.includes('ERROR'))
          .join('\n\n'),
      );
    }
    throw error;
  } finally {
    console.log = originalLog;
  }
  console.log(`App shell built; ${messages.join('\n').split('WARNING in').length - 1} build warnings.`);
  await new Promise((resolve, reject) =>
    webpack(
      {
        mode: 'development',
        devtool: false,
        entry: path.join(__dirname, 'queue-client.ts'),
        output: { path: output, filename: 'synthetic-client.js' },
        resolve: {
          extensions: ['.ts', '.js'],
          extensionAlias: { '.js': ['.js', '.ts'] },
          alias: { '@openmrs/esm-api$': path.join(__dirname, 'session.ts') },
        },
        module: {
          rules: [
            { test: /\.ts$/, use: { loader: 'swc-loader', options: { jsc: { parser: { syntax: 'typescript' } } } } },
          ],
        },
      },
      (error, stats) =>
        error || stats.hasErrors()
          ? reject(error || new Error(stats.toString({ all: false, errors: true })))
          : resolve(),
    ),
  );
  const client = readFileSync(path.join(output, 'synthetic-client.js'), 'utf8');
  let user = 'synthetic-a';
  let writes = new Map();
  let failAfterWrite = false;
  let outage = false;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:4183');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/openmrs/spa/importmap.json' || url.pathname === '/openmrs/spa/routes.registry.json') {
      response.setHeader('Content-Type', 'application/json');
      response.end(url.pathname.endsWith('importmap.json') ? JSON.stringify({ imports: {} }) : '[]');
      return;
    }
    if (url.pathname === '/control') {
      outage = url.searchParams.has('offline');
      user = url.searchParams.get('user') || 'synthetic-a';
      failAfterWrite = url.searchParams.has('fail');
      if (url.searchParams.has('reset')) writes = new Map();
      response.end(JSON.stringify([...writes]));
      return;
    }
    if (outage && url.pathname.startsWith('/openmrs/ws/')) {
      response.destroy();
      return;
    }
    if (url.pathname === '/openmrs/ws/rest/v1/session') {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify(
          request.method === 'DELETE' ? { authenticated: false } : { authenticated: true, user: { uuid: user } },
        ),
      );
      return;
    }
    if (url.pathname.startsWith('/openmrs/ws/test/')) {
      const id = url.pathname.split('/').at(-1);
      if (request.method === 'POST') {
        const exists = writes.has(id);
        writes.set(id, (writes.get(id) || 0) + 1);
        // Model the stable UUID create contract: a transport retry cannot create a second resource.
        if (exists) {
          response.statusCode = 409;
          response.end();
          return;
        }
        if (failAfterWrite) {
          response.destroy();
          return;
        }
      } else if (!writes.has(id)) {
        response.statusCode = 404;
      }
      response.end(JSON.stringify({ uuid: id }));
      return;
    }
    if (url.pathname === '/openmrs/ws/resource') {
      response.end(`synthetic-${user}`);
      return;
    }
    if (url.pathname === '/openmrs/spa/' || url.pathname === '/openmrs/spa/index.html') {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        `<!doctype html><title>Offline synthetic regression</title><p>Local synthetic regression</p><script>${client}</script>`,
      );
      return;
    }
    const relative = url.pathname.replace(/^\/openmrs\/spa\//, '');
    const file = path.resolve(output, relative);
    if (file.startsWith(`${output}${path.sep}`) && existsSync(file)) {
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(readFileSync(file));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  server.listen(4183, '127.0.0.1');
  const close = () =>
    server.close(() => {
      rmSync(output, { recursive: true, force: true });
      process.exit();
    });
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
start().catch((error) => {
  console.error(error);
  rmSync(output, { recursive: true, force: true });
  process.exit(1);
});
