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

test('absolutizes the social preview tags with the request host', () => {
  const config = readFileSync(resolve(workspaceRoot, 'nginx.spa.conf'), 'utf8');
  const subFilterMatches =
    config.match(/sub_filter 'content="\/openmrs\/spa' 'content="https:\/\/\$host\/openmrs\/spa';/g) ?? [];

  assert.equal(subFilterMatches.length, 2, 'both index-serving locations must rewrite the social preview URLs');
  assert.equal((config.match(/sub_filter_once off;/g) ?? []).length, 2);
  assert.ok(
    config.indexOf('location /openmrs/ {') > config.lastIndexOf('sub_filter'),
    'the backend proxy location must not rewrite proxied responses',
  );
});

test('copies the SPA assembly sources into both init images', () => {
  const dockerfile = readFileSync(resolve(workspaceRoot, 'Dockerfile'), 'utf8');
  const scriptDirectoryCopies =
    dockerfile.match(/packages\/tooling\/scripts\/\s+\.\/packages\/tooling\/scripts\//g) ?? [];
  const appShellDirectoryCopies =
    dockerfile.match(/packages\/tooling\/app-shell\/\s+\.\/packages\/tooling\/app-shell\//g) ?? [];

  assert.equal(scriptDirectoryCopies.length, 2);
  assert.equal(appShellDirectoryCopies.length, 2);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*packages\/tooling\/scripts\/assemble-importmap\.js/);
});

test('prevents the local SPA shell and module registries from being cached', () => {
  const startDev = readFileSync(resolve(workspaceRoot, 'packages/tooling/scripts/start-dev.js'), 'utf8');

  assert.match(
    startDev,
    /cliManagedPaths\.has\(req\.path\)[\s\S]*?'cache-control': 'no-store, no-cache, must-revalidate'/,
  );
  assert.match(
    startDev,
    /await ensureDevRuntimeReady\(\);[\s\S]*?'cache-control': 'no-store, no-cache, must-revalidate'/,
  );
});
