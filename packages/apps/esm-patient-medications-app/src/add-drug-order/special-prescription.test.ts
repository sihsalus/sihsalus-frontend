import { type Drug } from '@openmrs/esm-patient-common-lib';
import { DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES, findSpecialPrescriptionMatch } from './special-prescription';

function drugWith(display: string, conceptDisplay = ''): Drug {
  return {
    uuid: 'test-drug-uuid',
    display,
    strength: '',
    dosageForm: { uuid: 'test-dosage-form-uuid', display: 'Tablet' },
    concept: { uuid: 'test-concept-uuid', display: conceptDisplay },
  } as Drug;
}

describe('findSpecialPrescriptionMatch', () => {
  it('matches a listed substance regardless of salt, strength, and casing', () => {
    expect(
      findSpecialPrescriptionMatch(
        drugWith('MORFINA Clorhidrato 20 mg/mL solución inyectable'),
        DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES,
      ),
    ).toBe('morfina');
  });

  it('matches accent-insensitively in both directions', () => {
    expect(findSpecialPrescriptionMatch(drugWith('Cocaina clorhidrato 4%'), ['cocaína'])).toBe('cocaína');
    expect(findSpecialPrescriptionMatch(drugWith('Cocaína clorhidrato 4%'), ['cocaina'])).toBe('cocaina');
  });

  it('matches via the concept name when the drug display uses a brand name', () => {
    expect(
      findSpecialPrescriptionMatch(drugWith('Dolcontin 30 mg tableta', 'Morfina'), DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES),
    ).toBe('morfina');
  });

  it('does not flag unlisted drugs', () => {
    expect(
      findSpecialPrescriptionMatch(drugWith('Paracetamol 500 mg tableta', 'Paracetamol'), DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES),
    ).toBeNull();
  });

  it('matches whole words only, so fenobarbital does not hit the barbital entry', () => {
    expect(
      findSpecialPrescriptionMatch(drugWith('Fenobarbital 100 mg tableta'), DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES),
    ).toBe('fenobarbital');
    expect(findSpecialPrescriptionMatch(drugWith('Barbital sódico'), DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES)).toBe(
      'barbital',
    );
  });

  it('requires every word of a multi-word entry to be present', () => {
    expect(findSpecialPrescriptionMatch(drugWith('Morfina sulfato 10 mg'), ['morfina sulfato'])).toBe('morfina sulfato');
    expect(findSpecialPrescriptionMatch(drugWith('Morfina clorhidrato 10 mg'), ['morfina sulfato'])).toBeNull();
  });

  it('returns null when the drug is missing or the configured list is empty', () => {
    expect(findSpecialPrescriptionMatch(null, DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES)).toBeNull();
    expect(findSpecialPrescriptionMatch(drugWith('Morfina 10 mg'), [])).toBeNull();
  });

  it('has no default entry that normalizes to nothing', () => {
    for (const name of DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES) {
      expect(findSpecialPrescriptionMatch(drugWith(name), [name])).toBe(name);
    }
  });
});
