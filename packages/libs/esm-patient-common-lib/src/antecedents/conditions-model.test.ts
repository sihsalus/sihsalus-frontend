import type { FormFields, OpenmrsCondition } from './conditions.types';
import {
  buildConditionPayload,
  buildConditionUpdatePatch,
  getConditionNoteMaxLength,
  isConditionForPatient,
  isConditionResource,
  mapConditionProperties,
  sortConditions,
} from './conditions-model';

const source: OpenmrsCondition = {
  uuid: 'history-a',
  patient: { uuid: 'patient-a', display: 'Synthetic patient' },
  clinicalStatus: 'ACTIVE',
  verificationStatus: 'PROVISIONAL',
  condition: {
    coded: {
      uuid: 'concept-a',
      display: 'Synthetic antecedent',
      mappings: [{ code: 'Z00', source: 'CIE-10' }],
    },
    specificName: { uuid: 'specific-name-a', display: 'Recorded synonym' },
  },
  onsetDate: '2020-03-01T12:34:56.000-0500',
  auditInfo: { dateCreated: '2021-04-01T09:30:00.000+0000', creator: { uuid: 'original-user' } },
  additionalDetail: '__sihsalus_antecedent_type:family\nHistorical annotation',
  previousVersion: { uuid: 'previous-revision' },
  voided: false,
};
const fields: FormFields = {
  patientId: 'patient-a',
  providerUuid: 'provider-a',
  conceptId: 'concept-a',
  display: 'Synthetic antecedent',
  clinicalStatus: 'inactive',
};

describe('the native OpenMRS condition contract', () => {
  it('sends only the corrected status and preserves the immutable source and all its audit/terminology metadata', () => {
    const snapshot = structuredClone(source);
    const patch = buildConditionUpdatePatch(source.uuid, {
      ...fields,
      originalCondition: source,
      antecedentType: 'family',
      recordedDate: '2099-01-01',
    });
    expect(patch).toEqual({ clinicalStatus: 'INACTIVE' });
    expect(source).toEqual(snapshot);
  });

  it('does not fabricate registration dates or user/provider authorship', () => {
    const payload = buildConditionPayload({ ...fields, antecedentType: 'surgical' });
    expect(payload).toEqual({
      patient: 'patient-a',
      condition: { coded: 'concept-a' },
      clinicalStatus: 'INACTIVE',
      additionalDetail: '__sihsalus_antecedent_type:surgical',
    });
  });

  it('preserves absent verification without inventing clinical certainty', () => {
    const original = { ...source, verificationStatus: null };
    expect(isConditionResource(original)).toBe(true);
    expect(buildConditionPayload(fields)).not.toHaveProperty('verificationStatus');
    expect(buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: original })).toEqual({
      clinicalStatus: 'INACTIVE',
    });
  });

  it('normalizes case and surrounding whitespace before submitting an enum value', () => {
    expect(buildConditionPayload({ ...fields, clinicalStatus: ' Active ' }).clinicalStatus).toBe('ACTIVE');
    expect(
      buildConditionUpdatePatch(source.uuid, { ...fields, clinicalStatus: ' Active ', originalCondition: source }),
    ).toEqual({});
  });

  it('shows a safe placeholder for a blank historical narrative instead of enabling an empty edit', () => {
    const original = { ...source, condition: { nonCoded: '  ' } };
    expect(mapConditionProperties(original)).toMatchObject({ display: '--', nonCodedText: undefined });
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, conceptId: '', originalCondition: original }),
    ).toThrow(/representation/);
  });

  it('does not add an arbitrary antecedent classification to legacy concept-set creation', () => {
    expect(buildConditionPayload(fields)).not.toHaveProperty('additionalDetail');
  });

  it.each([
    'ACTIVE',
    'RECURRENCE',
    'RELAPSE',
    'INACTIVE',
    'REMISSION',
    'RESOLVED',
  ])('roundtrips %s without collapsing it to active/inactive', (status) => {
    const original = { ...source, clinicalStatus: status };
    const mapped = mapConditionProperties(original);
    expect(mapped.clinicalStatus.toUpperCase()).toBe(status);
    expect(buildConditionPayload({ ...fields, clinicalStatus: mapped.clinicalStatus }).clinicalStatus).toBe(status);
    expect(
      buildConditionUpdatePatch(original.uuid, {
        ...fields,
        clinicalStatus: mapped.clinicalStatus,
        originalCondition: original,
      }),
    ).toEqual({});
  });

  it('retains an unknown legacy status without inventing activity and blocks unsupported editing', () => {
    const original = { ...source, clinicalStatus: 'HISTORY_OF' };
    expect(isConditionResource(original)).toBe(true);
    expect(mapConditionProperties(original).clinicalStatus).toBe('History_of');
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, clinicalStatus: 'History_of', originalCondition: original }),
    ).toThrow(/status/);
  });

  it('does not implicitly convert an unsupported historical status during an otherwise valid correction', () => {
    const original = { ...source, clinicalStatus: 'HISTORY_OF' };
    expect(() => buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: original })).toThrow(
      /historical clinical status/,
    );
  });

  it('reads native narrative histories and corrects their status without rewriting their description', () => {
    const original = { ...source, condition: { nonCoded: 'Occupational exposure reported by patient' } };
    expect(mapConditionProperties(original)).toMatchObject({
      conceptId: '',
      nonCodedText: 'Occupational exposure reported by patient',
      display: 'Occupational exposure reported by patient',
    });
    expect(buildConditionUpdatePatch(original.uuid, { ...fields, conceptId: '', originalCondition: original })).toEqual(
      { clinicalStatus: 'INACTIVE' },
    );
  });

  it('does not reclassify an uncoded narrative as a newly definitive diagnosis', () => {
    const original = { ...source, condition: { nonCoded: 'Historical narrative' } };
    expect(() =>
      buildConditionUpdatePatch(original.uuid, {
        ...fields,
        conceptId: '',
        originalCondition: original,
        antecedentType: 'definitive-diagnosis',
      }),
    ).toThrow(expect.objectContaining({ code: 'CONDITION_CODED_DIAGNOSIS_REQUIRED' }));
    const legacy = { ...original, additionalDetail: '__sihsalus_antecedent_type:definitive-diagnosis' };
    expect(buildConditionUpdatePatch(legacy.uuid, { ...fields, conceptId: '', originalCondition: legacy })).toEqual({
      clinicalStatus: 'INACTIVE',
    });
  });

  it('creates native non-coded histories without a question UUID or a fabricated diagnosis', () => {
    const payload = buildConditionPayload({
      ...fields,
      conceptId: '',
      display: '',
      nonCodedText: '  Previous surgery reported  ',
      antecedentType: 'surgical',
    });
    expect(payload.condition).toEqual({ nonCoded: 'Previous surgery reported' });
    expect(payload.additionalDetail).toBe('__sihsalus_antecedent_type:surgical');
  });

  it('distinguishes the native concept UUID from its CIE-10 mapping and preferred synonym', () => {
    expect(mapConditionProperties(source)).toMatchObject({
      conceptId: 'concept-a',
      display: 'Recorded synonym',
      source,
      recordedDate: source.auditInfo?.dateCreated,
      antecedentType: 'family',
      noteText: 'Historical annotation',
    });
  });

  it('keeps an incomplete historical description readable without inventing a concept or date', () => {
    const original = { ...source, condition: {}, additionalDetail: null, auditInfo: undefined };
    expect(isConditionResource(original)).toBe(true);
    expect(mapConditionProperties(original)).toMatchObject({
      conceptId: '',
      display: '--',
      recordedDate: undefined,
      antecedentType: undefined,
    });
    expect(() =>
      buildConditionUpdatePatch(original.uuid, { ...fields, conceptId: '', originalCondition: original }),
    ).toThrow(/representation/);
  });

  it('preserves unedited whitespace and historical markers instead of generating an unnecessary correction', () => {
    const original = { ...source, additionalDetail: '  __sihsalus_antecedent_type:familiar\r\n  Original text  \r\n' };
    const patch = buildConditionUpdatePatch(original.uuid, {
      ...fields,
      clinicalStatus: 'active',
      originalCondition: original,
      antecedentType: 'family',
      note: 'Original text',
    });
    expect(patch).toEqual({});
  });

  it('changes type or note while retaining the other field and leaves the original revision untouched', () => {
    const original = structuredClone(source);
    expect(
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, note: 'Corrected text' }),
    ).toEqual({
      clinicalStatus: 'INACTIVE',
      additionalDetail: '__sihsalus_antecedent_type:family\nCorrected text',
    });
    expect(
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, antecedentType: 'social' })
        .additionalDetail,
    ).toBe('__sihsalus_antecedent_type:social\nHistorical annotation');
    expect(source).toEqual(original);
  });

  it.each([
    'patient-b',
    'patient-a-extra',
    '../patient-a',
    '',
    'Patient/patient-a',
  ])('rejects a mismatching or malformed patient identity: %s', (patientUuid) => {
    const original = { ...source, patient: { uuid: patientUuid } };
    expect(isConditionForPatient(original, 'patient-a')).toBe(false);
    expect(() => buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: original })).toThrow();
  });

  it('rejects voided records even when UUID and patient otherwise match', () => {
    expect(isConditionForPatient(source, 'patient-a')).toBe(true);
    const original = { ...source, voided: true };
    expect(isConditionForPatient(original, 'patient-a')).toBe(false);
    expect(() => buildConditionUpdatePatch(original.uuid, { ...fields, originalCondition: original })).toThrow(
      /current patient/,
    );
  });

  it.each([
    { patientId: '' },
    { patientId: '.' },
    { patientId: '..' },
    { patientId: '../patient-b' },
    { providerUuid: '' },
    { providerUuid: '  ' },
    { clinicalStatus: '' },
    { clinicalStatus: 'unknown' },
    { clinicalStatus: null },
    { antecedentType: 'unknown' },
    { antecedentType: 42 },
    { onsetDateTime: 'invalid' },
    { onsetDateTime: '2023-02-29' },
    { onsetDateTime: '2020-13-01' },
    { onsetDateTime: '2999-01-01' },
    { abatementDateTime: '2999-01-01' },
    { onsetDateTime: '2020' },
    { onsetDateTime: '2020-03' },
    { onsetDateTime: '2020-03-01', abatementDateTime: '2020-02-01' },
    { clinicalStatus: 'active', abatementDateTime: '2020-04-01' },
    { clinicalStatus: 'recurrence', abatementDateTime: '2020-04-01' },
    { nonCodedText: 'Both representations' },
    { conceptId: '', display: '', nonCodedText: '   ' },
    { conceptId: '../concept-a' },
    { conceptId: '.' },
    { conceptId: '..' },
    { conceptId: 42 },
    { note: {} },
    { conceptId: '', nonCodedText: 'Uncoded definitive diagnosis', antecedentType: 'definitive-diagnosis' },
  ])('rejects invalid write inputs before transport %#', (override) => {
    expect(() => buildConditionPayload({ ...fields, ...override } as FormFields)).toThrow();
  });

  it('requires an original snapshot matching both UUID and patient for updates', () => {
    expect(() => buildConditionUpdatePatch(source.uuid, fields)).toThrow(/current patient/);
    expect(() => buildConditionUpdatePatch('another-condition', { ...fields, originalCondition: source })).toThrow(
      /current patient/,
    );
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, conceptId: 'replacement' }),
    ).toThrow(/concept/);
  });

  it.each([
    '2020',
    '2020-03',
    '2020-03-01T12:34:56.000-0500',
  ])('preserves unedited date precision/timezone: %s', (date) => {
    const original = { ...source, onsetDate: date };
    expect(isConditionResource(original)).toBe(true);
    expect(buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: original })).toEqual({
      clinicalStatus: 'INACTIVE',
    });
    expect(mapConditionProperties(original).onsetDateTime).toBe(date);
  });

  it('allows correcting a date, but requires a replacement instead of silently erasing it', () => {
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, onsetDateTime: null }),
    ).toThrow(/cannot be removed/);
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, onsetDateTime: '' }),
    ).toThrow(/cannot be removed/);
    expect(
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, onsetDateTime: '2019-02-03' }),
    ).toEqual({ clinicalStatus: 'INACTIVE', onsetDate: '2019-02-03' });
  });

  it.each([
    null,
    {},
    { ...source, uuid: '../condition' },
    { ...source, patient: null },
    { ...source, condition: null },
    { ...source, condition: { coded: 'concept-a' } },
    { ...source, condition: { specificName: 'name-a' } },
    { ...source, condition: { nonCoded: 5 } },
    { ...source, additionalDetail: {} },
    { ...source, clinicalStatus: [] },
    { ...source, voided: undefined },
    { ...source, onsetDate: '2023-02-29' },
    { ...source, endDate: 'invalid' },
    { ...source, auditInfo: [] },
    { ...source, auditInfo: { dateCreated: 'invalid' } },
    { ...source, previousVersion: 'previous-revision' },
  ])('rejects malformed server data %#', (value) => {
    expect(isConditionResource(value)).toBe(false);
  });

  it('validates native narrative length without silently truncating it', () => {
    expect(buildConditionPayload({ ...fields, conceptId: '', nonCodedText: 'a'.repeat(255) }).condition).toEqual({
      nonCoded: 'a'.repeat(255),
    });
    expect(() => buildConditionPayload({ ...fields, conceptId: '', nonCodedText: 'a'.repeat(256) })).toThrow(
      expect.objectContaining({ code: 'CONDITION_TEXT_TOO_LONG' }),
    );
  });

  it('budgets the type marker within the persisted note column', () => {
    const limit = getConditionNoteMaxLength('family');
    expect(
      buildConditionPayload({ ...fields, antecedentType: 'family', note: 'a'.repeat(limit) }).additionalDetail,
    ).toHaveLength(255);
    expect(() => buildConditionPayload({ ...fields, antecedentType: 'family', note: 'a'.repeat(limit + 1) })).toThrow(
      expect.objectContaining({ code: 'CONDITION_TEXT_TOO_LONG' }),
    );
    expect(() =>
      buildConditionUpdatePatch(source.uuid, { ...fields, originalCondition: source, note: 'a'.repeat(limit + 1) }),
    ).toThrow(expect.objectContaining({ code: 'CONDITION_TEXT_TOO_LONG' }));
  });

  it('keeps longer legacy notes readable and does not block a status-only correction', () => {
    const original = { ...source, additionalDetail: '__sihsalus_antecedent_type:family\n' + 'a'.repeat(300) };
    expect(isConditionResource(original)).toBe(true);
    expect(mapConditionProperties(original).noteText).toHaveLength(300);
    expect(
      buildConditionUpdatePatch(original.uuid, {
        ...fields,
        originalCondition: original,
        antecedentType: 'family',
        note: 'a'.repeat(300),
      }),
    ).toEqual({ clinicalStatus: 'INACTIVE' });
  });

  it('sorts dates deterministically without mutating the input', () => {
    const input = ['b', 'a', 'c', 'd'].map((uuid, index) =>
      mapConditionProperties({
        ...source,
        uuid,
        onsetDate: index < 2 ? '2020-01-01' : index === 2 ? undefined : 'invalid',
      }),
    );
    expect(sortConditions(input).map((condition) => condition.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(input.map((condition) => condition.id)).toEqual(['b', 'a', 'c', 'd']);
  });
});
