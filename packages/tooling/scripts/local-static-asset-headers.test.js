const assert = require('node:assert/strict');
const test = require('node:test');

const { setLocalStaticAssetHeaders } = require('./local-static-asset-headers');

function captureHeaders(filePath) {
  const headers = new Map();
  const response = {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
  };

  setLocalStaticAssetHeaders(response, filePath);
  return headers;
}

test('serves AVIF assets with the MIME type required by Safari', () => {
  const headers = captureHeaders('/tmp/dist/spa/login.avif');

  assert.equal(headers.get('content-type'), 'image/avif');
});

test('matches AVIF extensions case-insensitively', () => {
  const headers = captureHeaders('/tmp/dist/spa/login.AVIF');

  assert.equal(headers.get('content-type'), 'image/avif');
});

test('lets Express infer MIME types for all other assets', () => {
  const headers = captureHeaders('/tmp/dist/spa/login.png');

  assert.equal(headers.has('content-type'), false);
});
