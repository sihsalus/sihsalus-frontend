import { getSearchableCellText, filterQueueTableRows } from './queue-table-filter';

describe('queue table search', () => {
  it('extracts text recursively from Carbon cell wrappers and React content', () => {
    const value = {
      content: (
        <a href="/patient/patient-uuid">
          <span>Ronaldo</span> Leon
        </a>
      ),
    };

    expect(getSearchableCellText(value)).toBe('Ronaldo  Leon');
  });

  it.each([undefined, null, false])('treats a missing or non-searchable %s cell as empty', (value) => {
    expect(getSearchableCellText(value)).toBe('');
  });

  it('does not throw when a patient has no phone number', () => {
    const filter = () =>
      filterQueueTableRows({
        rowIds: ['patient-row'],
        headers: [{ key: 'name' }, { key: 'phoneNumber' }],
        cellsById: {
          'patient-row:name': { value: 'Ronaldo Leon' },
          'patient-row:phoneNumber': { value: undefined },
        },
        inputValue: 'not-found',
        getCellId: (rowId, key) => `${rowId}:${key}`,
      });

    expect(filter).not.toThrow();
    expect(filter()).toEqual([]);
  });
});
