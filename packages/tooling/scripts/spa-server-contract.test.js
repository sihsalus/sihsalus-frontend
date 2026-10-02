const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workspaceRoot = resolve(__dirname, '..', '..', '..');

test('keeps the nginx SPA fallback and static-asset policy aligned', () => {
  const config = readFileSync(resolve(workspaceRoot, 'config/nginx.spa.conf'), 'utf8');
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
  const config = readFileSync(resolve(workspaceRoot, 'config/nginx.spa.conf'), 'utf8');
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

test('the SPA image and its workflow use the relocated Nginx configuration', () => {
  const dockerfile = readFileSync(resolve(workspaceRoot, 'Dockerfile'), 'utf8');
  const workflow = readFileSync(resolve(workspaceRoot, '.github/workflows/spa-image.yml'), 'utf8');

  assert.ok(existsSync(resolve(workspaceRoot, 'config/nginx.spa.conf')));
  assert.match(dockerfile, /^COPY config\/nginx\.spa\.conf \/etc\/nginx\/conf\.d\/default\.conf$/m);
  assert.match(workflow, /"config\/nginx\.spa\.conf"/);
});

test('init dependency preparation removes native compilers while retaining SPA assembly dependencies', () => {
  const dockerfile = readFileSync(resolve(workspaceRoot, 'Dockerfile'), 'utf8');
  const stage = dockerfile.match(/FROM builder AS init-dependencies\n([\s\S]*?)(?=\nFROM )/)?.[1];
  assert.ok(stage, 'native compilers must be removed before final image layers are created');
  const command = stage.replace(/\\\n\s*/g, ' ').match(/^RUN (.+)$/m)?.[1];
  assert.ok(command, 'the dependency preparation stage must prune build-only compilers');
  for (const target of ['init', 'secure-init']) {
    const body = dockerfile.split(new RegExp(`FROM [^\\n]+ AS ${target}\\n`))[1]?.split('\nFROM ')[0];
    assert.ok(body, `missing ${target}`);
    assert.match(body, /COPY --from=init-dependencies[^\n]* \/app\/node_modules \.\/node_modules/);
    assert.doesNotMatch(body, /COPY --from=builder[^\n]* \/app\/node_modules/);
  }

  const directory = mkdtempSync(resolve(tmpdir(), 'sihsalus-init-dependencies-'));
  const removed = [
    '@typescript/native/bin/tsc',
    '@typescript/typescript-linux-x64/lib/tsc',
    '@typescript/typescript-linux-arm64/lib/tsc',
    '.bin/tsc',
  ];
  const retained = ['typescript/lib/typescript.js', '@rspack/core/package.json', 'webpack/package.json'];
  try {
    for (const file of [...removed, ...retained]) {
      const path = resolve(directory, 'node_modules', file);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, 'synthetic dependency');
    }
    execFileSync('sh', ['-ec', command], { cwd: directory });
    for (const file of removed) assert.equal(existsSync(resolve(directory, 'node_modules', file)), false, file);
    for (const file of retained) {
      assert.equal(readFileSync(resolve(directory, 'node_modules', file), 'utf8'), 'synthetic dependency');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
