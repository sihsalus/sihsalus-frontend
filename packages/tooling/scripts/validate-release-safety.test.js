const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');

test('keeps synthetic E2E credentials out of the environment template', () => {
  const environmentTemplate = readFileSync(path.join(repositoryRoot, '.env.template'), 'utf8');

  for (const variableName of [
    'E2E_USERNAME',
    'E2E_PASSWORD',
    'E2E_PATIENT_UUID',
    'E2E_APPOINTMENTS_PATIENT_UUID',
  ]) {
    const matches = [...environmentTemplate.matchAll(new RegExp(`^${variableName}=([^\\r\\n]*)$`, 'gm'))];

    assert.equal(matches.length, 1, `${variableName} must appear exactly once`);
    assert.equal(matches[0][1].trim(), '', `${variableName} must not have a committed default value`);
  }

  assert.doesNotMatch(environmentTemplate, /^E2E_USER_ADMIN_(?:USERNAME|PASSWORD)=/m);
});

test('only releases branch images after CI succeeds for a push event', () => {
  const releaseWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');

  assert.match(
    releaseWorkflow,
    /github\.event_name == 'workflow_run'\s*&&\s*github\.event\.workflow_run\.event == 'push'\s*&&\s*github\.event\.workflow_run\.conclusion == 'success'/,
  );
  assert.match(releaseWorkflow, /CI_EVENT: \$\{\{ github\.event\.workflow_run\.event \}\}/);
  assert.match(releaseWorkflow, /\[\[ "\$\{CI_EVENT\}" != "push" \]\]/);
});

test('audits every workspace and transitive dependency at high severity', () => {
  const ciWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');

  assert.match(ciWorkflow, /run: yarn npm audit --all --recursive --severity high/);
});

test('keeps the external E2E smoke synthetic and does not claim to run the PR artifact', () => {
  const e2eWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/e2e.yml'), 'utf8');
  const e2eDocumentation = readFileSync(path.join(repositoryRoot, 'docs/e2e-testing.md'), 'utf8');
  const odontogramSpec = readFileSync(path.join(repositoryRoot, 'e2e/tests/odontogram-save.spec.ts'), 'utf8');
  const appointmentsSpec = readFileSync(path.join(repositoryRoot, 'e2e/tests/appointments-form.spec.ts'), 'utf8');

  for (const variableName of ['E2E_PATIENT_UUID', 'E2E_APPOINTMENTS_PATIENT_UUID']) {
    assert.match(e2eWorkflow, new RegExp(`${variableName}: \\$\\{\\{ vars\\.${variableName} \\}\\}`));
    assert.match(e2eWorkflow, new RegExp(`\\b${variableName}\\b`));
  }

  assert.match(e2eWorkflow, /E2E_DISABLE_WEB_SERVER:\s*["']true["']/);
  assert.match(e2eWorkflow, /external deployment/i);
  assert.match(e2eDocumentation, /smoke del SPA ya desplegado/i);
  assert.doesNotMatch(odontogramSpec, /E2E_PATIENT_UUID\s*\?\?/);
  assert.doesNotMatch(appointmentsSpec, /E2E_APPOINTMENTS_PATIENT_UUID\s*\?\?/);
});
