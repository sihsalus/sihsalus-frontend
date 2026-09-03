const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');
const ciWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const multiarchWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/multiarch.yml'), 'utf8');
const releaseWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');
const rootManifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));

test('CI audits every workspace and transitive dependency', () => {
  assert.match(ciWorkflow, /run: yarn security:audit/);
  assert.equal(
    rootManifest.scripts['security:audit'],
    'yarn validate:react-router && yarn npm audit --all --recursive --severity high',
  );
  assert.doesNotMatch(rootManifest.scripts['security:audit'], /--ignore/);
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
  assert.doesNotMatch(scanStep, /trivyignores:/);

  const promotionStep = releaseWorkflow.slice(promotionIndex);
  assert.match(promotionStep, /imagetools create --prefer-index=false/);
  assert.match(promotionStep, /PROMOTED_DIGEST.*IMAGE_DIGEST/s);
});

test('multiarch scans both immutable platforms before promoting its mutable alias', () => {
  const buildIndex = multiarchWorkflow.indexOf('- name: Build and publish commit-addressed multiarch image');
  const amd64ScanIndex = multiarchWorkflow.indexOf('- name: Scan immutable image (linux/amd64)');
  const arm64ScanIndex = multiarchWorkflow.indexOf('- name: Scan immutable image (linux/arm64)');
  const enforcementIndex = multiarchWorkflow.indexOf('- name: Enforce multiarch scan results');
  const revalidationIndex = multiarchWorkflow.indexOf('- name: Revalidate main before promotion');
  const promotionIndex = multiarchWorkflow.indexOf('- name: Promote verified multiarch image');

  assert.ok(buildIndex >= 0, 'commit-addressed multiarch build step is missing');
  assert.ok(amd64ScanIndex > buildIndex, 'amd64 must be scanned after the image is built');
  assert.ok(arm64ScanIndex > amd64ScanIndex, 'arm64 must also be scanned');
  assert.ok(enforcementIndex > arm64ScanIndex, 'both scan outcomes must be enforced');
  assert.ok(revalidationIndex > enforcementIndex, 'main must be revalidated after the scans');
  assert.ok(promotionIndex > revalidationIndex, 'the mutable tag must be promoted last');

  const buildStep = multiarchWorkflow.slice(buildIndex, amd64ScanIndex);
  assert.match(buildStep, /tags: ghcr\.io\/sihsalus\/sihsalus-frontend:multiarch-sha-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(buildStep, /steps\.meta\.outputs\.tags/);

  const scanSteps = multiarchWorkflow.slice(amd64ScanIndex, enforcementIndex);
  assert.equal((scanSteps.match(/image-ref: .*@\$\{\{ steps\.build\.outputs\.digest \}\}/g) ?? []).length, 2);
  assert.match(scanSteps, /TRIVY_PLATFORM: linux\/amd64/);
  assert.match(scanSteps, /TRIVY_PLATFORM: linux\/arm64/);
  assert.equal((scanSteps.match(/exit-code: '1'/g) ?? []).length, 2);
  assert.doesNotMatch(scanSteps, /trivyignores:/);
  assert.equal((scanSteps.match(/limit-severities-for-sarif: true/g) ?? []).length, 2);

  const promotionStep = multiarchWorkflow.slice(promotionIndex);
  assert.match(promotionStep, /imagetools create --tag/);
  assert.match(promotionStep, /PROMOTED_DIGEST.*IMAGE_DIGEST/s);
});
