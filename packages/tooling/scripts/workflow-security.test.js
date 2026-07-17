const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');
const ciWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const releaseWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');

test('CI audits every workspace and transitive dependency', () => {
  assert.match(ciWorkflow, /yarn npm audit --all --recursive --severity high/);
});

test('release builds the exact commit that passed CI', () => {
  assert.match(
    releaseWorkflow,
    /ref: \$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.head_sha \|\| github\.ref \}\}/,
  );
  assert.match(releaseWorkflow, /CI_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(releaseWorkflow, /CI_SHA.*RELEASE_SHA/s);
});

test('release scans the immutable digest before promoting mutable aliases', () => {
  const buildIndex = releaseWorkflow.indexOf('- name: Build and publish immutable image');
  const scanIndex = releaseWorkflow.indexOf('- name: Scan immutable image before promotion');
  const promotionIndex = releaseWorkflow.indexOf('- name: Promote verified image aliases');

  assert.ok(buildIndex >= 0, 'immutable image build step is missing');
  assert.ok(scanIndex > buildIndex, 'the immutable image must be scanned after it is built');
  assert.ok(scanIndex >= 0, 'immutable image scan step is missing');
  assert.ok(promotionIndex > scanIndex, 'mutable aliases must be promoted only after the image scan');

  const buildStep = releaseWorkflow.slice(buildIndex, scanIndex);
  assert.match(buildStep, /tags: ghcr\.io\/sihsalus\/sihsalus-frontend:sha-\$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.doesNotMatch(buildStep, /steps\.meta\.outputs\.tags/);
  assert.doesNotMatch(buildStep, /(?:^|\n)\s*tags:.*(?:latest|next)/);

  const scanStep = releaseWorkflow.slice(scanIndex, promotionIndex);
  assert.match(scanStep, /image-ref: .*@\$\{\{ steps\.build\.outputs\.digest \}\}/);
  assert.match(scanStep, /severity: HIGH,CRITICAL/);
  assert.match(scanStep, /exit-code: '1'/);

  const promotionStep = releaseWorkflow.slice(promotionIndex);
  assert.match(promotionStep, /imagetools create --prefer-index=false/);
  assert.match(promotionStep, /PROMOTED_DIGEST.*IMAGE_DIGEST/s);
});
