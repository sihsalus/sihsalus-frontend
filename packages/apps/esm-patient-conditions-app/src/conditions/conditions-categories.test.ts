import type { Condition } from './conditions.resource';
import {
  type ConditionDestination,
  defaultStatusFilterBySection,
  filterConditionsBySection,
  getConditionDestination,
} from './conditions-categories';

describe('condition categories', () => {
  it.each<[string | undefined, string, ConditionDestination]>([
    ['pathological', 'active', 'active-problems'],
    [undefined, 'Active', 'active-problems'],
    ['pathological', 'inactive', 'other-antecedents'],
    ['family', 'active', 'other-antecedents'],
    ['social', 'active', 'other-antecedents'],
    ['previous-hospitalization', 'active', 'other-antecedents'],
    ['other', 'active', 'other-antecedents'],
    ['definitive-diagnosis', 'active', 'past-diagnoses'],
    ['definitive-diagnosis', 'inactive', 'past-diagnoses'],
    ['surgical', 'inactive', 'other-antecedents'],
    ['pathological', 'Recurrence', 'active-problems'],
    ['pathological', 'Relapse', 'active-problems'],
    [undefined, 'Recurrence', 'active-problems'],
    ['unknown-legacy-type', 'Relapse', 'active-problems'],
    ['pathological', 'Remission', 'other-antecedents'],
    ['pathological', 'Resolved', 'other-antecedents'],
    [undefined, '', 'other-antecedents'],
  ])('routes type %s with status %s to %s', (antecedentType, clinicalStatus, expectedDestination) => {
    expect(getConditionDestination(antecedentType, clinicalStatus)).toBe(expectedDestination);
  });

  it.each([
    'family',
    'social',
    'surgical',
    'previous-hospitalization',
    'other',
  ])('never interprets a %s antecedent as an active disease of the patient', (type) => {
    for (const status of ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved', undefined]) {
      expect(getConditionDestination(type, status)).toBe('other-antecedents');
    }
  });

  it('keeps every surgical antecedent visible and places each record in exactly one detailed section', () => {
    const conditions: Condition[] = [
      ['surgical', 'Resolved'],
      ['family', 'Active'],
      ['social', 'Recurrence'],
      ['pathological', 'Relapse'],
      ['definitive-diagnosis', 'Inactive'],
      ['pathological', 'Remission'],
    ].map(([antecedentType, clinicalStatus], index) => ({
      id: `synthetic-${index}`,
      antecedentType: antecedentType as Condition['antecedentType'],
      clinicalStatus,
      conceptId: 'synthetic-concept',
      display: 'Synthetic antecedent',
      source: {
        uuid: `synthetic-${index}`,
        patient: { uuid: 'synthetic-patient' },
        clinicalStatus: clinicalStatus.toUpperCase(),
        condition: { coded: { uuid: 'synthetic-concept' } },
        voided: false,
      },
    }));
    const sections = ['active-problems', 'past-diagnoses', 'other-antecedents'] as const;
    const visible = sections.flatMap((section) => filterConditionsBySection(conditions, section));
    expect(visible).toHaveLength(conditions.length);
    expect(new Set(visible.map(({ id }) => id)).size).toBe(conditions.length);
    expect(filterConditionsBySection(conditions, 'antecedents')).toContain(conditions[0]);
    expect(filterConditionsBySection(conditions, 'other-antecedents')).toContain(conditions[0]);
  });

  it('shows all records initially except in the active-problems section', () => {
    expect(defaultStatusFilterBySection).toEqual({
      antecedents: 'All',
      'active-problems': 'Active',
      'other-antecedents': 'All',
      'past-diagnoses': 'All',
    });
  });
});
