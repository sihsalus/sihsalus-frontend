import { formatDatetime, openmrsFetch, usePagination } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSwr } from 'test-utils';
import type { Mock } from 'vitest';
import { mockPreviousImports } from '../../test-utils/mocks/openconceptlab.mock';

import PreviousImports from './previous-imports.component';

const mockOpenmrsFetch = openmrsFetch as Mock;
const mockUsePagination = usePagination as Mock;

describe('Previous imports', () => {
  it('renders the table', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });
    mockUsePagination.mockReturnValue({
      currentPage: 1,
      goTo: () => {},
      results: [],
    });
    renderWithSwr(<PreviousImports />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Previous Imports')).toBeVisible();
    expect(screen.getByText('Date and Time')).toBeVisible();
    expect(screen.getByText('Duration')).toBeVisible();
    expect(screen.getByText('Status')).toBeVisible();
  });

  it('renders the previous imports correctly', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: mockPreviousImports } });
    mockUsePagination.mockReturnValue({
      currentPage: 1,
      goTo: () => {},
      results: mockPreviousImports,
    });
    renderWithSwr(<PreviousImports />);
    await waitForLoadingToFinish();

    mockPreviousImports.forEach((item) => {
      expect(screen.getByText(formatDatetime(item.localDateStarted))).toBeVisible();
      expect(screen.getByText(item.importTime)).toBeVisible();
      expect(screen.getByText(item.status)).toBeVisible();
    });
  });
});

function waitForLoadingToFinish() {
  return waitFor(() => {
    expect(screen.getByText('Previous Imports')).toBeVisible();
  });
}
