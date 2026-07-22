const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workspaceRoot = resolve(__dirname, '..', '..', '..');

test('keeps the nginx SPA fallback and static-asset policy aligned', () => {
  const config = readFileSync(resolve(workspaceRoot, 'nginx.spa.conf'), 'utf8');
  const avifLocation = config.indexOf('location ~* ^/openmrs/spa/(?<asset>.+\\.avif)$');
  const dottedAssetLocation = config.indexOf('location ~ ^/openmrs/spa/(?<asset>.+\\.[^/]+)$');
  const routeLocation = config.indexOf('location /openmrs/spa/');

  assert.ok(avifLocation >= 0, 'nginx must define an explicit AVIF content type');
  assert.ok(dottedAssetLocation > avifLocation, 'the generic asset location must follow the AVIF override');
  assert.ok(routeLocation > dottedAssetLocation, 'asset requests must be handled before the SPA route fallback');
  assert.match(config, /default_type image\/avif;/);
  assert.match(config, /location ~ "[^"]*\{8,\}[^"]*" \{/);
  assert.match(config, /try_files \$uri \$uri\/ \/openmrs\/spa\/index\.html;/);
  assert.doesNotMatch(config, /try_files[^;]* \/index\.html;/);
});

test('copies the SPA assembly module boundary into both init images', () => {
  const dockerfile = readFileSync(resolve(workspaceRoot, 'Dockerfile'), 'utf8');
  const scriptDirectoryCopies =
    dockerfile.match(/packages\/tooling\/scripts\/\s+\.\/packages\/tooling\/scripts\//g) ?? [];

  assert.equal(scriptDirectoryCopies.length, 2);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*packages\/tooling\/scripts\/assemble-importmap\.js/);
});

test('prevents the local SPA shell and module registries from being cached', () => {
  const startDev = readFileSync(resolve(workspaceRoot, 'packages/tooling/scripts/start-dev.js'), 'utf8');

  assert.match(startDev, /cliManagedPaths\.has\(req\.path\)[\s\S]*?'cache-control': 'no-store, no-cache, must-revalidate'/);
  assert.match(startDev, /await ensureDevRuntimeReady\(\);[\s\S]*?'cache-control': 'no-store, no-cache, must-revalidate'/);
});
