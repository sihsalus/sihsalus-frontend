import {
  defaultStatusFilterBySection,
  getConditionDestination,
  type ConditionDestination,
} from './conditions-categories';

describe('condition categories', () => {
  it.each<[string | undefined, string, ConditionDestination]>([
    ['pathological', 'active', 'active-problems'],
    [undefined, 'Active', 'active-problems'],
    ['pathological', 'inactive', 'other-antecedents'],
    ['family', 'active', 'active-problems'],
    ['social', 'active', 'active-problems'],
    ['previous-hospitalization', 'active', 'active-problems'],
    ['other', 'active', 'active-problems'],
    ['definitive-diagnosis', 'active', 'past-diagnoses'],
    ['definitive-diagnosis', 'inactive', 'past-diagnoses'],
    ['surgical', 'inactive', 'procedures'],
  ])('routes type %s with status %s to %s', (antecedentType, clinicalStatus, expectedDestination) => {
    expect(getConditionDestination(antecedentType, clinicalStatus)).toBe(expectedDestination);
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
