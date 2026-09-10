import { convertToCSV } from './cohort-builder.utils';
import { addStoredSearchHistory, clearStoredSearchHistory, getStoredSearchHistory } from './search-history-store';
import type { Patient, Query } from './types';

afterEach(clearStoredSearchHistory);

it('preserves the original query and export columns when a caller changes its inputs', () => {
  const query: Query = {
    type: 'synthetic',
    columns: [],
    rowFilters: [{ key: 'synthetic-filter' }],
    customRowFilterCombination: '1',
  };
  const patients: Patient[] = [{ id: '101', name: 'Synthetic name', age: 30, gender: 'F' }];
  addStoredSearchHistory('Synthetic search', patients, query);
  patients[0].name = 'Changed name';
  query.rowFilters[0].key = 'changed-filter';
  expect(getStoredSearchHistory()[0]).toMatchObject({
    patients: [{ name: 'Synthetic name' }],
    parameters: { rowFilters: [{ key: 'synthetic-filter' }] },
  });
});

it('exports the patient ID and escapes quotes, line breaks, and spreadsheet formulas', () => {
  const csv = convertToCSV([
    { id: '101', name: 'Synthetic "quoted"\nname', age: 30, gender: 'F' },
    { id: '102', name: '=SYNTHETIC()', age: 40, gender: 'M' },
  ]);
  expect(csv).toContain('"101","Synthetic ""quoted""\nname","30","F"');
  expect(csv).toContain('"102","\'=SYNTHETIC()","40","M"');
  expect(csv).not.toContain('undefined');
});
