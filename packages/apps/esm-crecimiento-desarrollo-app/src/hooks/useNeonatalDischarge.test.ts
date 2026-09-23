import { configSchema } from '../config-schema';
import { getNeonatalDischarge } from './useNeonatalDischarge';
import { getNextCREDControlRecommendation, getNextCREDMinimumDate } from '../utils/cred-control-intervals';

const config = { formsList: configSchema.formsList._default, neonatalConcepts: configSchema.neonatalConcepts._default };
const birth = '2026-01-01T09:00:00-05:00';
const discharge = '2026-01-03T15:30:00-05:00';
const pregnancy = {
  uuid: 'synthetic-pregnancy',
  encounterDatetime: birth,
  form: { uuid: 'pregnancy', name: config.formsList.pregnancyDetails },
  obs: [
    {
      concept: { uuid: config.neonatalConcepts.birthPlaceUuid },
      value: { uuid: config.neonatalConcepts.deliveryRoomPlaceUuid },
    },
  ],
};
const birthEncounter = {
  uuid: 'synthetic-birth',
  encounterDatetime: discharge,
  form: { uuid: 'birth', name: config.formsList.birthDetails },
  obs: [{ concept: { uuid: config.neonatalConcepts.dischargeDateTimeUuid }, value: discharge }],
};

describe('neonatal discharge timing', () => {
  it('uses the infant birth form and keeps the exact 48-hour minimum', () => {
    const context = getNeonatalDischarge([pregnancy, birthEncounter], birth, config);
    expect(context.missingDischarge).toBe(false);
    expect(getNextCREDMinimumDate(birth, [], context.dischargeDate)).toEqual(new Date('2026-01-05T15:30:00-05:00'));
    expect(
      getNextCREDControlRecommendation(birth, [], [], '2026-01-04T09:00:00-05:00', context.dischargeDate)?.targetDate,
    ).toEqual(new Date('2026-01-05T15:30:00-05:00'));
  });

  it('does not substitute a later hospitalization or a different form for birth discharge', () => {
    const otherDischarge = { ...birthEncounter, form: { uuid: 'later-hospitalization', name: 'Epicrisis' } };
    expect(getNeonatalDischarge([pregnancy, otherDischarge], birth, config).missingDischarge).toBe(true);
  });

  it.each([
    'invalid',
    '2025-12-31T10:00:00Z',
    '2099-01-01T00:00:00Z',
  ])('rejects invalid birth discharge %s', (value) => {
    const encounter = { ...birthEncounter, obs: [{ ...birthEncounter.obs[0], value }] };
    expect(getNeonatalDischarge([pregnancy, encounter], birth, config)).toEqual({
      dischargeDate: undefined,
      missingDischarge: true,
    });
  });

  it('does not resurrect an old discharge after the latest birth form clears it', () => {
    const cleared = { ...birthEncounter, uuid: 'updated', encounterDatetime: '2026-01-04T09:00:00-05:00', obs: [] };
    expect(getNeonatalDischarge([pregnancy, birthEncounter, cleared], birth, config).missingDischarge).toBe(true);
  });

  it('ignores voided encounters and refuses ambiguous discharge values', () => {
    expect(getNeonatalDischarge([pregnancy, { ...birthEncounter, voided: true }], birth, config).missingDischarge).toBe(
      true,
    );
    expect(
      getNeonatalDischarge(
        [pregnancy, { ...birthEncounter, obs: [...birthEncounter.obs, ...birthEncounter.obs] }],
        birth,
        config,
      ).missingDischarge,
    ).toBe(true);
  });

  it('does not assume the delivery setting when it is unknown', () => {
    expect(getNeonatalDischarge([birthEncounter], birth, config).missingDischarge).toBe(true);
  });

  it('treats a null birth setting and an invalid encounter date as missing context', () => {
    const unknown = { ...pregnancy, obs: [{ ...pregnancy.obs[0], value: null }] };
    expect(getNeonatalDischarge([unknown, birthEncounter], birth, config).missingDischarge).toBe(true);
    expect(
      getNeonatalDischarge([pregnancy, { ...birthEncounter, encounterDatetime: 'invalid' }], birth, config)
        .missingDischarge,
    ).toBe(true);
  });

  it('does not impose a hospital discharge on a documented home birth', () => {
    const home = {
      ...pregnancy,
      obs: [{ ...pregnancy.obs[0], value: { uuid: config.neonatalConcepts.homeBirthPlaceUuid } }],
    };
    expect(getNeonatalDischarge([home], birth, config).missingDischarge).toBe(false);
  });

  it('retains the seven-day interval for the second control on day 14', () => {
    expect(
      getNextCREDMinimumDate(birth, [{ encounterDatetime: '2026-01-08T09:00:00-05:00', controlNumber: 1 }]),
    ).toEqual(new Date('2026-01-15T09:00:00-05:00'));
  });
});
