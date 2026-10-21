import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type ImmunizationConfigObject } from './config-schema';
import { linkConfiguredSequences } from './immunizations/utils';

const config = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

describe('NTS 246 product and routine sequence contract', () => {
  it.each([
    ['b328841a-7c35-4f39-8f64-be15ff33b7bf', [1]],
    ['7a5c2fbc-6848-44c9-b9a2-f9a37fe17ae8', [1]],
    ['41844230-91cc-5983-8c28-1275dda75b6f', [1, 2, 3]],
    ['964748ed-787b-5629-9469-dd49e9243421', [1, 2, 3, 11]],
    ['e1cb9975-7474-5d2c-ae81-0beb5235f26a', [12]],
    ['308fe0e6-a6c9-54a9-b499-e01e53a42b5c', [1, 2, 3]],
    ['f709d361-8e2a-5253-bd17-7bd34577aeea', [1, 2]],
  ])('links OCL product %s to its routine dose labels', (vaccineUuid, expectedDoses) => {
    const [group] = linkConfiguredSequences(
      [{ vaccineUuid, vaccineName: 'Synthetic product', existingDoses: [] }],
      config.sequenceDefinitions,
    );
    expect(group.sequences.map((dose) => dose.sequenceNumber)).toEqual(expectedDoses);
  });

  it('does not turn special-population or progressive programmes into universal schedules', () => {
    const varicella = config.sequenceDefinitions.find(
      (item) => item.vaccineConceptUuid === '9f33fb25-b37e-545e-946d-202295c42ab0',
    );
    expect(varicella.sequences.map((dose) => dose.sequenceNumber)).toEqual([1]);
    expect(
      config.sequenceDefinitions.find((item) => item.vaccineConceptUuid === 'f0000181-0000-4000-8000-000000000181'),
    ).toBeUndefined();
    expect(
      config.sequenceDefinitions.find((item) => item.vaccineConceptUuid === 'f0000180-0000-4000-8000-000000000180'),
    ).toBeUndefined();
  });

  it('keeps routine ages as months and does not autosuggest next dates from approximate day intervals', () => {
    const ipv = config.sequenceDefinitions.find(
      (item) => item.vaccineConceptUuid === '964748ed-787b-5629-9469-dd49e9243421',
    );
    expect(ipv.sequences.map((dose) => dose.minAgeInMonths)).toEqual([2, 4, 6, 18]);
    expect(
      config.sequenceDefinitions
        .flatMap((item) => item.sequences)
        .every((dose) => dose.intervalInDaysAfterPreviousDose === undefined),
    ).toBe(true);
  });
});
