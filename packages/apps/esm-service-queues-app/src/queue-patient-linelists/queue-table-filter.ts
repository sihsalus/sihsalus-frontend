interface DataTableHeader {
  key: string;
}

export interface DataTableFilterProps {
  rowIds: Array<string>;
  headers: Array<DataTableHeader>;
  cellsById: Record<string, { value?: unknown } | undefined>;
  inputValue: string;
  getCellId: (rowId: string, key: string) => string;
}

export function getSearchableCellText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getSearchableCellText).join(' ');
  }

  if (typeof value === 'object') {
    if (Object.hasOwn(value, 'content')) {
      return getSearchableCellText((value as { content?: unknown }).content);
    }

    const props = (value as { props?: unknown }).props;
    if (props && typeof props === 'object' && Object.hasOwn(props, 'children')) {
      return getSearchableCellText((props as { children?: unknown }).children);
    }
  }

  return '';
}

export function filterQueueTableRows({
  rowIds,
  headers,
  cellsById,
  inputValue,
  getCellId,
}: DataTableFilterProps): Array<string> {
  const filterTerm = inputValue.toLocaleLowerCase();
  if (!filterTerm) {
    return rowIds;
  }

  return rowIds.filter((rowId) =>
    headers.some(({ key }) => {
      const filterableValue = cellsById[getCellId(rowId, key)]?.value;
      return getSearchableCellText(filterableValue).toLocaleLowerCase().includes(filterTerm);
    }),
  );
}
