const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { findMissingFhirDependencies, sourceUsesOpenmrsFhir } = require('./validate-fhir-dependencies');

test('detects framework FHIR imports, including aliases, without matching external FHIR configuration', () => {
  assert.equal(sourceUsesOpenmrsFhir("import { fhirBaseUrl as baseUrl } from '@openmrs/esm-framework';"), true);
  assert.equal(sourceUsesOpenmrsFhir("import { useFhirFetchAll } from '@openmrs/esm-framework';"), true);
  assert.equal(
    sourceUsesOpenmrsFhir("import * as framework from '@openmrs/esm-framework'; framework.fhirBaseUrl;"),
    true,
  );
  assert.equal(
    sourceUsesOpenmrsFhir("import * as framework from '@openmrs/esm-framework'; framework.restBaseUrl;"),
    false,
  );
  assert.equal(sourceUsesOpenmrsFhir("const config = { fhirBaseUrl: 'https://external.example.test' };"), false);
  assert.equal(sourceUsesOpenmrsFhir("import { fhirBaseUrl } from './dyaku-config';"), false);
});

test('flags missing FHIR2 manifests and accepts optional FHIR2 declarations', () => {
  const apps = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-fhir-manifests-'));
  try {
    for (const app of ['missing', 'optional']) {
      const source = path.join(apps, app, 'src');
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, 'index.ts'), "import { fhirBaseUrl } from '@openmrs/esm-framework';");
      fs.writeFileSync(
        path.join(source, 'routes.json'),
        JSON.stringify(app === 'optional' ? { optionalBackendDependencies: { fhir2: '>=1.2' } } : {}),
      );
    }
    assert.deepEqual(
      findMissingFhirDependencies(apps).map(({ app }) => app),
      ['missing'],
    );
  } finally {
    fs.rmSync(apps, { recursive: true, force: true });
  }
});

test('every app using framework FHIR declares the backend capability', () => {
  assert.deepEqual(findMissingFhirDependencies(), []);
});
