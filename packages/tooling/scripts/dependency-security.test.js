const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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
