import { mockImportItems, mockPreviousImports } from '@mocks/openconceptlab.mock';
import { usePagination } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSwr } from '@tools/test-helpers';

import ImportItems from './import-items.component';
import { useImportItems } from './import-items.resource';

const defaultProps = {
  importUuid: mockPreviousImports[1].uuid,
};

const mockUseImportItems = useImportItems as vi.Mock;
const mockUsePagination = usePagination as vi.Mock;

vi.mock('./import-items.resource', () => ({
  useImportItems: vi.fn(),
}));

describe('Import items', () => {
  it('renders a tabular overview', async () => {
    mockUseImportItems.mockReturnValue({ data: mockImportItems, isLoading: false, error: null });
    mockUsePagination.mockReturnValue({
      currentPage: 1,
      goTo: () => {},
      results: mockImportItems,
    });
    renderWithSwr(<ImportItems {...defaultProps} />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Concept/Mapping')).toBeVisible();
    expect(screen.getByText('Message')).toBeVisible();
  });

  it('renders the import items correctly', async () => {
    mockUseImportItems.mockReturnValue({ data: mockImportItems, isLoading: false, error: null });
    mockUsePagination.mockReturnValue({
      currentPage: 1,
      goTo: () => {},
      results: mockImportItems,
    });
    renderWithSwr(<ImportItems {...defaultProps} />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Concept/Mapping')).toBeVisible();
    expect(screen.getByText('Message')).toBeVisible();

    mockImportItems.slice(5).forEach((importItem) => {
      expect(screen.getByText(importItem.type + ' ' + importItem.uuid)).toBeVisible();
      expect(screen.getByText(importItem.errorMessage)).toBeVisible();
    });
  });
});

function waitForLoadingToFinish() {
  return waitFor(() => {
    expect(screen.getByText('Concept/Mapping')).toBeVisible();
  });
}
