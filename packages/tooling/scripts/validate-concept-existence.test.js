const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { extractConceptReferences } = require('./validate-concept-existence');

describe('extractConceptReferences', () => {
  it('extracts flat ConceptUuid defaults regardless of property order', () => {
    const source = `
      export const configSchema = {
        therapeuticIndicationsUuid: {
          _type: Type.ConceptUuid,
          _description: 'Therapeutic indications concept',
          _default: 'b762afd0-dfc6-430d-8963-0be05f77a12a',
        },
        chiefComplaintUuid: {
          _default: '71b58cff-879b-4358-98d5-2165434d4324',
          _type: Type.ConceptUuid,
        },
        legacyCielUuid: {
          _type: Type.ConceptUuid,
          _default: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      };
    `;

    const references = extractConceptReferences(source, 'apps/example/src/config-schema.ts');

    assert.deepEqual(
      references.map((ref) => ref.uuid),
      [
        'b762afd0-dfc6-430d-8963-0be05f77a12a',
        '71b58cff-879b-4358-98d5-2165434d4324',
        '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ],
    );
    assert.equal(references[0].key, 'therapeuticIndicationsUuid');
  });

  it('ignores entries that are not typed as ConceptUuid', () => {
    const source = `
      export const configSchema = {
        encounterTypeUuid: {
          _type: Type.UUID,
          _default: 'd7151f82-c1f3-4152-a605-2f9ea7414a79',
        },
        formName: {
          _type: Type.String,
          _default: 'CE-001-CONSULTA EXTERNA',
        },
      };
    `;

    assert.deepEqual(extractConceptReferences(source, 'file.ts'), []);
  });

  it('extracts the target uuids of the legacy concept compatibility map', () => {
    const source = `
      const defaultLegacyConceptCompatibilityMap = {
        '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '71b58cff-879b-4358-98d5-2165434d4324',
        '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      };
    `;

    const references = extractConceptReferences(source, 'apps/esm-form-engine-app/src/config-schema.ts');

    assert.deepEqual(
      references.map((ref) => ref.uuid),
      ['71b58cff-879b-4358-98d5-2165434d4324', '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
    );
    assert.match(references[0].key, /^legacyConceptCompatibilityMap\['5219A/);
  });

  it('resolves ConceptUuid defaults backed by same-file constant objects', () => {
    const source = `
      export const clinicalConcepts = {
        anamnesis: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
        appetite: 'f0000182-0000-4000-8000-000000000182',
      } as const;

      export const configSchema = {
        anamnesisUuid: {
          _type: Type.ConceptUuid,
          _default: clinicalConcepts.anamnesis,
        },
        appetiteUuid: {
          _default: clinicalConcepts.appetite,
          _type: Type.ConceptUuid,
        },
      };
    `;

    const references = extractConceptReferences(source, 'apps/example/src/config-schema.ts');

    assert.deepEqual(
      references.map((ref) => [ref.key, ref.uuid, ref.source]),
      [
        ['anamnesisUuid', '6d99603e-ae9d-4838-8a09-ba75e27ff1e9', 'ConceptUuid constant default'],
        ['appetiteUuid', 'f0000182-0000-4000-8000-000000000182', 'ConceptUuid constant default'],
      ],
    );
  });
});
