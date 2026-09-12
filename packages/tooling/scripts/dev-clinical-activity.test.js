const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { Agent } = require('undici');
const {
  clinicalActivityPath,
  clinicalActivityTimeoutMs,
  createClinicalActivityHandler,
} = require('./dev-clinical-activity');

async function listen(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function proxy(t, backend, options = {}) {
  const app = express();
  app.all('*', createClinicalActivityHandler({ backend, ...options }));
  return listen(t, app);
}

function request(origin, { method = 'POST', path = clinicalActivityPath, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(origin);
    const req = http.request({ hostname, port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }),
      );
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('forwards only a bodyless presence signal to the gateway root and acknowledges its 204', async (t) => {
  const received = [];
  const backend = await listen(t, (req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      received.push({
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(204, { 'set-cookie': 'SYNTHETIC_UPSTREAM_COOKIE', 'x-private': 'DO_NOT_FORWARD' });
      res.end();
    });
  });
  const origin = await proxy(t, `${backend}/custom/openmrs`);
  const result = await request(origin, {
    headers: { 'x-private': 'SYNTHETIC_BROWSER_HEADER', origin: 'http://localhost' },
  });

  assert.equal(result.status, 204);
  assert.equal(result.body, '');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(result.headers['x-private'], undefined);
  assert.equal(received.length, 1);
  assert.equal(received[0].method, 'POST');
  assert.equal(received[0].path, clinicalActivityPath);
  assert.equal(received[0].body, '');
  for (const header of ['authorization', 'proxy-authorization', 'cookie', 'referer', 'origin', 'x-private']) {
    assert.equal(received[0].headers[header], undefined);
  }
});

test('rejects other methods, routes, query, body framing and credentials without reaching the gateway', async (t) => {
  let upstreamRequests = 0;
  const backend = await listen(t, (_req, res) => {
    upstreamRequests += 1;
    res.writeHead(204).end();
  });
  const origin = await proxy(t, backend);

  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal((await request(origin, { method })).status, 405);
  }
  for (const options of [
    { path: `${clinicalActivityPath}?private=SYNTHETIC` },
    { path: `${clinicalActivityPath}?` },
    { path: `${clinicalActivityPath}/` },
    { path: `${clinicalActivityPath}/extra` },
    { path: '/_SIHSALUS/clinical-activity' },
    { path: '/_sihsalus/clinical%2dactivity' },
    { path: '/_sihsalus/clinical-activity;private=SYNTHETIC' },
    { body: 'SYNTHETIC_BODY' },
    { headers: { 'transfer-encoding': 'chunked' } },
    { headers: { authorization: 'Bearer SYNTHETIC_CREDENTIAL' } },
    { headers: { 'proxy-authorization': 'Basic SYNTHETIC_CREDENTIAL' } },
    { headers: { cookie: 'synthetic=DO_NOT_FORWARD' } },
    { headers: { cookie: '' } },
    { headers: { referer: 'http://localhost/private/SYNTHETIC' } },
  ]) {
    const result = await request(origin, options);
    assert.equal(result.status, 400);
    assert.equal(result.body, '');
  }
  assert.equal(upstreamRequests, 0);
});

test('preserves upstream error statuses while discarding every upstream header and body', async (t) => {
  let upstreamStatus = 400;
  const backend = await listen(t, (_req, res) => {
    res.writeHead(upstreamStatus, {
      'content-type': 'application/json',
      'set-cookie': 'SYNTHETIC_COOKIE',
      'x-private': 'SYNTHETIC_HEADER',
      location: '/SYNTHETIC_REDIRECT',
    });
    res.end('DO_NOT_FORWARD_UPSTREAM_BODY');
  });
  const origin = await proxy(t, backend);

  for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) {
    upstreamStatus = status;
    const result = await request(origin);
    assert.equal(result.status, status);
    assert.equal(result.body, '');
    for (const header of ['set-cookie', 'x-private', 'location', 'content-type']) {
      assert.equal(result.headers[header], undefined);
    }
  }
});

test('rejects unexpected successes and redirects without following their location', async (t) => {
  let redirectRequests = 0;
  const redirectTarget = await listen(t, (_req, res) => {
    redirectRequests += 1;
    res.writeHead(204).end();
  });
  let upstreamStatus = 200;
  const backend = await listen(t, (_req, res) => {
    res.writeHead(upstreamStatus, { location: `${redirectTarget}/SYNTHETIC_PRIVATE_PATH` });
    res.end('DO_NOT_FORWARD');
  });
  const origin = await proxy(t, backend);

  for (const status of [200, 201, 202, 205, 301, 302, 303, 304, 307, 308]) {
    upstreamStatus = status;
    const result = await request(origin);
    assert.equal(result.status, 502);
    assert.equal(result.headers.location, undefined);
    assert.equal(result.body, '');
  }
  assert.equal(redirectRequests, 0);
});

test('reports network failures without leaking transport details', async (t) => {
  const backend = await listen(t, (req) => req.socket.destroy());
  const origin = await proxy(t, backend);
  const result = await request(origin);
  assert.equal(result.status, 502);
  assert.equal(result.body, '');
});

test('bounds a stalled gateway request and returns 504', async (t) => {
  const backend = await listen(t, () => {});
  const origin = await proxy(t, backend, { timeoutMs: 50 });
  const startedAt = Date.now();
  const result = await request(origin);
  assert.equal(result.status, 504);
  assert.equal(result.body, '');
  assert.ok(Date.now() - startedAt < 2000);
  assert.equal(clinicalActivityTimeoutMs, 3000);
});

test('uses the existing TLS dispatcher factory without forwarding inbound headers', async (t) => {
  const backend = await listen(t, (_req, res) => res.writeHead(204).end());
  const dispatcher = new Agent({ connect: { rejectUnauthorized: true } });
  t.after(() => dispatcher.close());
  let dispatcherCalls = 0;
  let fetchCalls = 0;
  const origin = await proxy(t, backend, {
    getBackendFetchDispatcher() {
      dispatcherCalls += 1;
      return dispatcher;
    },
    fetchImpl(url, options) {
      fetchCalls += 1;
      assert.equal(options.dispatcher, dispatcher);
      assert.equal(options.headers, undefined);
      assert.equal(options.body, null);
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      assert.equal(options.redirect, 'manual');
      return fetch(url, options);
    },
  });
  assert.equal((await request(origin)).status, 204);
  assert.equal((await request(origin, { body: 'SYNTHETIC' })).status, 400);
  assert.equal(dispatcherCalls, 1);
  assert.equal(fetchCalls, 1);
});

test('leaves the default TLS transport intact when no dispatcher is configured', async (t) => {
  const backend = await listen(t, (_req, res) => res.writeHead(204).end());
  const origin = await proxy(t, backend, {
    fetchImpl(url, options) {
      assert.equal(Object.hasOwn(options, 'dispatcher'), false);
      return fetch(url, options);
    },
  });
  assert.equal((await request(origin)).status, 204);
});

test('does not expose exceptions from the dispatcher or fetch factory', async (t) => {
  let upstreamRequests = 0;
  const backend = await listen(t, (_req, res) => {
    upstreamRequests += 1;
    res.writeHead(204).end();
  });
  for (const property of ['getBackendFetchDispatcher', 'fetchImpl']) {
    const origin = await proxy(t, backend, {
      [property]() {
        throw new Error('DO_NOT_FORWARD_SYNTHETIC_CREDENTIAL');
      },
    });
    const result = await request(origin);
    assert.equal(result.status, 502);
    assert.equal(result.body, '');
  }
  assert.equal(upstreamRequests, 0);
});

test('rejects invalid timeout configuration and credential-bearing backends safely', () => {
  for (const timeoutMs of [0, -1, 3001, Infinity, NaN, 1.5]) {
    assert.throws(() => createClinicalActivityHandler({ backend: 'http://127.0.0.1', timeoutMs }), {
      message: 'Invalid clinical activity timeout configuration.',
    });
  }
  assert.throws(
    () => createClinicalActivityHandler({ backend: 'https://SYNTHETIC:DO_NOT_FORWARD@example.test' }),
    (error) => !error.message.includes('SYNTHETIC') && !error.message.includes('DO_NOT_FORWARD'),
  );
});
