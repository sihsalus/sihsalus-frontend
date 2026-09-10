import { addStoredSearchHistory, clearStoredSearchHistory, getStoredSearchHistory } from '../../search-history-store';
import type { Query } from '../../types';
import { createCompositionQuery, isCompositionValid } from './composition.utils';

const makeQuery = (filterCount: number, prefix: string): Query => ({
  type: 'org.openmrs.module.reporting.dataset.definition.PatientDataSetDefinition',
  columns: [],
  rowFilters: Array.from({ length: filterCount }, (_, index) => ({ key: `${prefix}-${index + 1}` })),
  customRowFilterCombination: Array.from({ length: filterCount }, (_, index) => index + 1).join(' AND '),
});

beforeEach(() => clearStoredSearchHistory());

describe('composition syntax', () => {
  it.each([
    '1',
    ' 1 and 2 ',
    '(1 OR 2) AND NOT 3',
    '((1 AND 2))',
    'NOT (1 OR 2)',
    '1 UNION 2',
    '1 INTERSECTION 2',
    '1 + !2',
    '10 AND 12',
  ])('accepts a complete expression: %s', (expression) => expect(isCompositionValid(expression)).toBe(true));

  it.each([
    '',
    ' ',
    '1 AND',
    'AND 1',
    '1 2',
    '(1 AND 2',
    '1 AND 2)',
    '1 AND ()',
    '1 OR OR 2',
    '1 AND 2garbage',
    '1 XOR 2',
    '0 AND 1',
    '-1',
    '1.5',
    '9007199254740993',
  ])('rejects an invalid expression: %s', (expression) => expect(isCompositionValid(expression)).toBe(false));
});

it('renumbers every filter reference, including multi-digit references', () => {
  addStoredSearchHistory('Synthetic first search', [], makeQuery(2, 'first'));
  const second = makeQuery(10, 'second');
  second.customRowFilterCombination += ' OR NOT 10';
  addStoredSearchHistory('Synthetic second search', [], second);

  const { query } = createCompositionQuery('1 AND 2');

  expect(query.customRowFilterCombination).toBe(
    '(1 AND 2) AND (3 AND 4 AND 5 AND 6 AND 7 AND 8 AND 9 AND 10 AND 11 AND 12 OR NOT 12)',
  );
  expect(query.rowFilters.map(({ key }) => key)).toEqual([
    'first-1',
    'first-2',
    ...Array.from({ length: 10 }, (_, index) => `second-${index + 1}`),
  ]);
});

it('leaves history unchanged so repeated compositions produce the same query', () => {
  addStoredSearchHistory('Synthetic first search', [], makeQuery(1, 'first'));
  addStoredSearchHistory('Synthetic second search', [], makeQuery(2, 'second'));
  const originalHistory = structuredClone(getStoredSearchHistory());

  const first = createCompositionQuery('1 AND 2');
  const repeated = createCompositionQuery('1 AND 2');

  expect(getStoredSearchHistory()).toEqual(originalHistory);
  expect(repeated).toEqual(first);
});

it('preserves nested parentheses and repeated operands', () => {
  addStoredSearchHistory('Synthetic first search', [], makeQuery(1, 'first'));
  addStoredSearchHistory('Synthetic second search', [], makeQuery(1, 'second'));

  const { query } = createCompositionQuery('((1 OR 2)) AND NOT 1');

  expect(query.customRowFilterCombination.replace(/\s/g, '')).toBe('(((1)OR(2)))ANDNOT(3)');
  expect(query.rowFilters.map(({ key }) => key)).toEqual(['first-1', 'second-1', 'first-1']);
});

it('resolves multi-digit history numbers as whole references', () => {
  for (let index = 1; index <= 10; index++) {
    addStoredSearchHistory(`Synthetic search ${index}`, [], makeQuery(1, `search-${index}`));
  }

  expect(createCompositionQuery('10').query.rowFilters).toEqual([{ key: 'search-10-1' }]);
});

it('rejects missing history and malformed input before constructing a query', () => {
  addStoredSearchHistory('Synthetic search', [], makeQuery(1, 'first'));

  expect(() => createCompositionQuery('1 AND 2')).toThrow();
  expect(() => createCompositionQuery('1 AND')).toThrow();
});
