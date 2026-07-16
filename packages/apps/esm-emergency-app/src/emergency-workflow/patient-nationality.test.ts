import {
  buildNationalityAttribute,
  getAutomaticNationalityUpdate,
  getNationalitySelectionUpdate,
  isCompletedPeruDni,
  isNationalityConceptUuid,
} from './patient-nationality';

const attributeTypeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1007';
const peruConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';

describe('patient nationality', () => {
  it('builds a coded OpenMRS person attribute', () => {
    expect(
      buildNationalityAttribute({
        allowedConceptUuids: new Set([peruConceptUuid]),
        attributeTypeUuid,
        isUnknown: false,
        nationality: peruConceptUuid,
      }),
    ).toEqual({ attributeType: attributeTypeUuid, value: peruConceptUuid });
  });

  it('omits nationality for unidentified patients even if stale form data exists', () => {
    expect(
      buildNationalityAttribute({
        allowedConceptUuids: new Set([peruConceptUuid]),
        attributeTypeUuid,
        isUnknown: true,
        nationality: peruConceptUuid,
      }),
    ).toBeNull();
  });

  it('rejects legacy country codes and concepts outside the configured catalog', () => {
    expect(() => buildNationalityAttribute({ attributeTypeUuid, isUnknown: false, nationality: 'PE' })).toThrow(
      /no es un concepto válido/u,
    );
    expect(() =>
      buildNationalityAttribute({
        allowedConceptUuids: new Set([peruConceptUuid]),
        attributeTypeUuid,
        isUnknown: false,
        nationality: colombiaConceptUuid,
      }),
    ).toThrow(/no pertenece al catálogo/u);
  });

  it('recognizes concept UUIDs but not ISO country codes', () => {
    expect(isNationalityConceptUuid(peruConceptUuid)).toBe(true);
    expect(isNationalityConceptUuid('PE')).toBe(false);
  });

  it('recognizes only a complete eight-digit Peru DNI for automatic inference', () => {
    expect(isCompletedPeruDni('12345678')).toBe(true);
    expect(isCompletedPeruDni(' 12345678 ')).toBe(true);
    expect(isCompletedPeruDni('1234567')).toBe(false);
    expect(isCompletedPeruDni('1234567A')).toBe(false);
  });

  it('assigns Peru only for a completed DNI and clears only an automatic assignment', () => {
    expect(
      getAutomaticNationalityUpdate({
        currentNationality: '',
        hasCompletedDni: true,
        isUnknown: false,
        peruConceptUuid,
        wasAutoAssigned: false,
      }),
    ).toEqual({ nationality: peruConceptUuid, shouldUpdate: true, wasAutoAssigned: true });

    expect(
      getAutomaticNationalityUpdate({
        currentNationality: peruConceptUuid,
        hasCompletedDni: false,
        isUnknown: false,
        peruConceptUuid,
        wasAutoAssigned: true,
      }),
    ).toEqual({ nationality: '', shouldUpdate: true, wasAutoAssigned: false });
  });

  it('preserves automatic provenance when Carbon echoes the controlled Peru selection', () => {
    const assigned = getAutomaticNationalityUpdate({
      currentNationality: '',
      hasCompletedDni: true,
      isUnknown: false,
      peruConceptUuid,
      wasAutoAssigned: false,
    });
    const echoed = getNationalitySelectionUpdate({
      currentNationality: assigned.nationality,
      selectedNationality: peruConceptUuid,
      wasAutoAssigned: assigned.wasAutoAssigned,
    });

    expect(echoed).toEqual({ nationality: peruConceptUuid, shouldUpdate: false, wasAutoAssigned: true });
    expect(
      getAutomaticNationalityUpdate({
        currentNationality: echoed.nationality,
        hasCompletedDni: false,
        isUnknown: false,
        peruConceptUuid,
        wasAutoAssigned: echoed.wasAutoAssigned,
      }),
    ).toEqual({ nationality: '', shouldUpdate: true, wasAutoAssigned: false });
  });

  it('marks a genuinely different nationality selection as manual', () => {
    expect(
      getNationalitySelectionUpdate({
        currentNationality: peruConceptUuid,
        selectedNationality: colombiaConceptUuid,
        wasAutoAssigned: true,
      }),
    ).toEqual({ nationality: colombiaConceptUuid, shouldUpdate: true, wasAutoAssigned: false });
  });

  it('preserves explicitly selected nationalities and clears unknown-patient nationality', () => {
    expect(
      getAutomaticNationalityUpdate({
        currentNationality: colombiaConceptUuid,
        hasCompletedDni: false,
        isUnknown: false,
        peruConceptUuid,
        wasAutoAssigned: false,
      }),
    ).toEqual({ nationality: colombiaConceptUuid, shouldUpdate: false, wasAutoAssigned: false });

    expect(
      getAutomaticNationalityUpdate({
        currentNationality: colombiaConceptUuid,
        hasCompletedDni: true,
        isUnknown: false,
        peruConceptUuid,
        wasAutoAssigned: false,
      }),
    ).toEqual({ nationality: colombiaConceptUuid, shouldUpdate: false, wasAutoAssigned: false });

    expect(
      getAutomaticNationalityUpdate({
        currentNationality: colombiaConceptUuid,
        hasCompletedDni: false,
        isUnknown: true,
        peruConceptUuid,
        wasAutoAssigned: false,
      }),
    ).toEqual({ nationality: '', shouldUpdate: true, wasAutoAssigned: false });
  });
});
