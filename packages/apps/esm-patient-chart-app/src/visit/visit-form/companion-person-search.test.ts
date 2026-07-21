import dayjs from 'dayjs';

import { getPersonAge } from './companion-person-search.workspace';

describe('getPersonAge', () => {
  const today = dayjs('2026-07-20');

  it('uses the age returned by the backend when available', () => {
    expect(getPersonAge({ uuid: 'person', display: 'Persona', age: 42 }, today)).toBe(42);
  });

  it('calculates age from birthdate when the backend does not return age', () => {
    expect(getPersonAge({ uuid: 'person', display: 'Persona', birthdate: '1980-07-21' }, today)).toBe(45);
  });

  it('does not infer an age from missing, invalid, or future birthdates', () => {
    expect(getPersonAge({ uuid: 'person', display: 'Persona' }, today)).toBeUndefined();
    expect(getPersonAge({ uuid: 'person', display: 'Persona', birthdate: 'invalid' }, today)).toBeUndefined();
    expect(getPersonAge({ uuid: 'person', display: 'Persona', birthdate: '2027-01-01' }, today)).toBeUndefined();
  });
});
