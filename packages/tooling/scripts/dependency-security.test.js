const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const repositoryRoot = path.resolve(__dirname, '../../..');
const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
const yarnLock = readFileSync(path.join(repositoryRoot, 'yarn.lock'), 'utf8');

const protectedDependencies = [
  { name: 'flatted', minimumSafeVersion: '3.4.2' },
  { name: 'shell-quote', minimumSafeVersion: '1.8.4' },
  { name: 'sigstore', minimumSafeVersion: '4.1.1' },
];

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExactResolutionVersion(name) {
  const resolution = packageJson.resolutions?.[name];
  assert.equal(typeof resolution, 'string', `${name} must have an explicit root resolution`);

  const match = /^(?:npm:)?(\d+\.\d+\.\d+)$/.exec(resolution);
  assert.ok(match, `${name} must use an exact semantic version resolution`);
  return match[1];
}

function getLockedVersions(name) {
  const pattern = new RegExp(`^  resolution: "${escapeRegExp(name)}@npm:(\\d+\\.\\d+\\.\\d+)"$`, 'gm');
  return [...yarnLock.matchAll(pattern)].map((match) => match[1]);
}

test('known vulnerable transitive dependencies stay above their patched versions', () => {
  for (const { name, minimumSafeVersion } of protectedDependencies) {
    const resolutionVersion = getExactResolutionVersion(name);
    assert.ok(
      compareVersions(resolutionVersion, minimumSafeVersion) >= 0,
      `${name} resolution ${resolutionVersion} is below patched version ${minimumSafeVersion}`,
    );

    const lockedVersions = getLockedVersions(name);
    assert.ok(lockedVersions.length > 0, `${name} is missing from yarn.lock`);
    for (const lockedVersion of lockedVersions) {
      assert.ok(
        compareVersions(lockedVersion, minimumSafeVersion) >= 0,
        `${name}@${lockedVersion} in yarn.lock is vulnerable; require at least ${minimumSafeVersion}`,
      );
    }
  }
});

test('brace-expansion stays patched and compatible with every minimatch API generation', async () => {
  const braceExpansionResolutions = Object.entries(packageJson.resolutions).filter(([descriptor]) =>
    descriptor.startsWith('brace-expansion@'),
  );
  assert.equal(braceExpansionResolutions.length, 5, 'all brace-expansion resolution ranges must remain protected');

  for (const [descriptor, resolution] of braceExpansionResolutions) {
    assert.match(
      resolution,
      /^patch:brace-expansion@npm%3A5\.0\.8#~\/\.yarn\/patches\/brace-expansion-npm-5\.0\.8-/,
      `${descriptor} must resolve to the patched brace-expansion@5.0.8 package`,
    );
  }

  assert.doesNotMatch(
    yarnLock,
    /^ {2}resolution: "brace-expansion@npm:(?:[0-4]\.|5\.0\.[0-7])/m,
    'yarn.lock must not contain a vulnerable brace-expansion release',
  );

  const braceExpand = require('brace-expansion');
  assert.equal(require('brace-expansion/package.json').version, '5.0.8');
  assert.equal(typeof braceExpand, 'function', 'legacy CommonJS consumers must receive a callable export');
  assert.equal(typeof braceExpand.expand, 'function', 'current consumers must receive the named expand export');
  assert.deepEqual(braceExpand('{a,b}'), ['a', 'b']);
  assert.deepEqual(braceExpand.expand('{c,d}'), ['c', 'd']);

  const esmBraceExpand = await import('brace-expansion');
  assert.equal(typeof esmBraceExpand.default, 'function', 'legacy ESM consumers must receive the default export');
  assert.deepEqual(esmBraceExpand.default('{e,f}'), ['e', 'f']);

  for (const { owner, hasEsmBuild } of [
    { owner: 'walk-sync', hasEsmBuild: false },
    { owner: 'filelist', hasEsmBuild: false },
    { owner: '@swc/cli', hasEsmBuild: true },
  ]) {
    const consumerRequire = createRequire(require.resolve(owner));
    const minimatchPackage = consumerRequire('minimatch/package.json');
    const minimatchModule = consumerRequire('minimatch');
    const minimatch = typeof minimatchModule === 'function' ? minimatchModule : minimatchModule.minimatch;

    assert.equal(
      minimatch('patient.js', '{patient,visit}.js'),
      true,
      `minimatch@${minimatchPackage.version} used by ${owner} must remain functional`,
    );

    if (hasEsmBuild) {
      const minimatchPackageDirectory = path.dirname(consumerRequire.resolve('minimatch/package.json'));
      const esmMinimatch = await import(pathToFileURL(path.join(minimatchPackageDirectory, 'dist/esm/index.js')));
      assert.equal(
        esmMinimatch.minimatch('patient.js', '{patient,visit}.js'),
        true,
        `ESM minimatch@${minimatchPackage.version} used by ${owner} must remain functional`,
      );
    }
  }

  assert.equal(require('minimatch').minimatch('patient.js', '{patient,visit}.js'), true);
});
