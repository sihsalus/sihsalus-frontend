import { collectTestTypes, type OrderableTestConcept, searchTestTypes } from './test-type-matching';

// Names/UUID verified read-only in SIHSALUS/laboratorio/1300 on 2026-09-07.
// Metadata only: no patient fixture and no assumption of deployed orderability.
const hematocrit: OrderableTestConcept = {
  uuid: '9a9c73d0-76e6-4b84-b20c-dfe8efea9542',
  display: 'Prueba de hematocrito',
  names: ['Hct', 'Hematocrit', 'Prueba de hematocrito', 'PCV', 'Packed cell volume', 'Crit', 'Hto'].map((display) => ({
    display,
  })),
};

const catalog = collectTestTypes([hematocrit], {});

describe('catalog concept name matching', () => {
  it.each([
    'hematocrito',
    ' HÉMATOCRITO ',
    'hemato',
    'matocri',
    'Hct',
    'Hto',
    'PCV',
    'packed cell',
    'volume cell packed',
  ])('finds the original hematocrit concept using %s', (query) => {
    expect(searchTestTypes(catalog, query)).toEqual([
      expect.objectContaining({
        conceptUuid: hematocrit.uuid,
        label: hematocrit.display,
      }),
    ]);
    expect(searchTestTypes(catalog, query)[0].approximateMatch).toBeUndefined();
  });

  it.each([
    'hematocrtio',
    'hematocito',
    'hematocritoo',
    'hematocryto',
  ])('labels a single spelling error (%s) as approximate', (query) => {
    expect(searchTestTypes(catalog, query)[0]).toEqual(
      expect.objectContaining({
        conceptUuid: hematocrit.uuid,
        approximateMatch: true,
      }),
    );
  });

  it('does not invent a recuento synonym or mix words from different names', () => {
    expect(searchTestTypes(catalog, 'recuento de hematocrito')).toEqual([]);
    expect(searchTestTypes(catalog, 'packed hematocrito')).toEqual([]);
  });

  it('uses a recuento synonym when explicitly supplied by the configured catalog', () => {
    const configuredCatalog = collectTestTypes(
      [
        {
          ...hematocrit,
          names: [...hematocrit.names, { display: 'Recuento de hematocrito' }],
        },
      ],
      {},
    );
    expect(searchTestTypes(configuredCatalog, 'hematocrito recuento')[0].conceptUuid).toBe(hematocrit.uuid);
  });

  it('prefers direct names over approximate matches', () => {
    const tests = collectTestTypes(
      [
        hematocrit,
        {
          uuid: 'synthetic-spelling-test',
          display: 'Hematocrito X',
          names: [{ display: 'Hematocryto' }],
        },
      ],
      {},
    );
    expect(searchTestTypes(tests, 'hematocryto').map((test) => test.conceptUuid)).toEqual(['synthetic-spelling-test']);
  });

  it('keeps similarly named methods as separate concepts', () => {
    const tests = collectTestTypes(
      [
        { uuid: 'synthetic-method-one', display: 'Alanina IFCC con piridoxal' },
        { uuid: 'synthetic-method-two', display: 'Alanina IFCC sin piridoxal' },
      ],
      {},
    );
    expect(searchTestTypes(tests, 'IFCC alanina')).toHaveLength(2);
    expect(searchTestTypes(tests, 'alanina con piridoxal').map((test) => test.conceptUuid)).toEqual([
      'synthetic-method-one',
    ]);
  });

  it.each([
    'Htc',
    'IgM',
    'hepatitis C',
    'glucosa 124 horas',
    'glucosa 2 horas',
  ])('does not approximately substitute short codes or numbers: %s', (query) => {
    const tests = collectTestTypes(
      [
        hematocrit,
        { uuid: 'synthetic-igg', display: 'Hepatitis B IgG' },
        { uuid: 'synthetic-24', display: 'Glucosa 24 horas' },
      ],
      {},
    );
    expect(searchTestTypes(tests, query)).toEqual([]);
  });

  it('merges names of non-adjacent duplicate UUIDs, not different tests or retired concepts', () => {
    const tests = collectTestTypes(
      [
        { uuid: 'synthetic-group-a', display: 'A', setMembers: [hematocrit] },
        { uuid: 'synthetic-other', display: 'Hemograma' },
        {
          uuid: 'synthetic-group-b',
          display: 'B',
          setMembers: [{ ...hematocrit, names: [{ name: 'Otra etiqueta' }] }],
        },
        { uuid: 'synthetic-retired', display: 'Retirado', retired: true },
      ],
      { [hematocrit.uuid]: ['Alias configurado'] },
    );
    expect(tests).toHaveLength(2);
    const test = tests.find((test) => test.conceptUuid === hematocrit.uuid);
    expect(test.synonyms).toEqual(expect.arrayContaining(['Hct', 'Otra etiqueta', 'Alias configurado']));
    expect(test.groupLabel).toBe('A');
  });

  it('searches both concept names and provided synonyms, excluding voided names', () => {
    const tests = collectTestTypes(
      [
        {
          ...hematocrit,
          synonyms: ['Nombre adicional'],
          names: [{ display: 'Nombre anulado', voided: true }, { name: 'Nombre activo' }],
        },
      ],
      {},
    );
    expect(searchTestTypes(tests, 'adicional')).toHaveLength(1);
    expect(searchTestTypes(tests, 'activo')).toHaveLength(1);
    expect(searchTestTypes(tests, 'anulado')).toHaveLength(0);
  });

  it('handles empty inputs without making a grammatical word match everything', () => {
    expect(searchTestTypes(catalog, '  ')).toEqual(catalog);
    expect(searchTestTypes(catalog, 'de la')).toEqual([]);
    expect(searchTestTypes([], 'hematocrito')).toEqual([]);
  });
});
