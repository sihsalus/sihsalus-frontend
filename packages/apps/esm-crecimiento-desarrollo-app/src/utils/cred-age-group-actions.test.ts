import { canRegisterCREDControlFromAgeGroup } from './cred-age-group-actions';

describe('canRegisterCREDControlFromAgeGroup', () => {
  const controls = [
    { ageGroupLabel: '0 AÑOS', status: 'overdue' },
    { ageGroupLabel: '1 AÑO', status: 'future' },
  ];

  it('does not start a new control from a historical age group', () => {
    expect(canRegisterCREDControlFromAgeGroup('0 AÑOS', '1 AÑO', controls)).toBe(false);
  });

  it('allows a pending control from the current age group', () => {
    expect(canRegisterCREDControlFromAgeGroup('1 AÑO', '1 AÑO', controls)).toBe(true);
  });

  it('does not start a control when all current-group entries are already completed or scheduled', () => {
    expect(
      canRegisterCREDControlFromAgeGroup('1 AÑO', '1 AÑO', [
        { ageGroupLabel: '1 AÑO', status: 'completed' },
        { ageGroupLabel: '1 AÑO', status: 'scheduled' },
      ]),
    ).toBe(false);
  });
});
