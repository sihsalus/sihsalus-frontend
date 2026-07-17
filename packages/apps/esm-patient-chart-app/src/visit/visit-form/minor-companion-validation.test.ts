import dayjs from 'dayjs';
import { getMinorCompanionRequirementState, isPatientMinor } from './minor-companion-validation';

describe('minor companion validation', () => {
  const today = dayjs('2026-07-17');

  it('requires a companion until the patient turns 18', () => {
    expect(isPatientMinor('2008-07-18', today)).toBe(true);
    expect(isPatientMinor('2008-07-17', today)).toBe(false);
    expect(isPatientMinor('2000-01-01', today)).toBe(false);
  });

  it('does not classify missing, invalid, or future birth dates as minors', () => {
    expect(isPatientMinor(null, today)).toBe(false);
    expect(isPatientMinor('not-a-date', today)).toBe(false);
    expect(isPatientMinor('2026-07-18', today)).toBe(false);
  });

  it('blocks a minor while companions load or when none are registered', () => {
    expect(getMinorCompanionRequirementState(true, true, 0)).toBe('loading');
    expect(getMinorCompanionRequirementState(true, false, 0)).toBe('missing');
  });

  it('allows a minor with a companion and does not affect adults', () => {
    expect(getMinorCompanionRequirementState(true, false, 1)).toBe('satisfied');
    expect(getMinorCompanionRequirementState(false, false, 0)).toBe('not-required');
  });
});
