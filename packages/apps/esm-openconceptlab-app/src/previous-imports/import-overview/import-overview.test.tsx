import { mockPreviousImports } from '@mocks/openconceptlab.mock';
import { formatDatetime } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSwr } from '@tools/test-helpers';
import type { Import } from '../../types';

import ImportOverview from './import-overview.component';

describe('Import Overview component', () => {
  it('renders the fields', async () => {
    renderImportOverviewComponent(mockPreviousImports[0]);
    await waitForLoadingToFinish();

    expect(screen.getByText('Started on')).toBeVisible();
    expect(screen.getByText('Completed on')).toBeVisible();
    expect(screen.getByText('Duration')).toBeVisible();
    expect(screen.getByText('Result:')).toBeVisible();
  });

  it('renders the import details when no errored items', async () => {
    const selectedImport = mockPreviousImports[0];

    renderImportOverviewComponent(selectedImport);
    await waitForLoadingToFinish();

    const startedTimeText = formatDatetime(selectedImport.localDateStarted);
    const stoppedTimeText = formatDatetime(selectedImport.localDateStopped);
    const upToDateItemsText = selectedImport.upToDateItemsCount + ' concepts up to date';
    const addedItemsText = selectedImport.addedItemsCount + ' concepts added';
    const updatedItemsText = selectedImport.updatedItemsCount + ' concepts updated';
    const retiredItemsText = selectedImport.retiredItemsCount + ' concepts retired';
    const errorItemsText = selectedImport.errorItemsCount + ' errors found';
    const ignoredErrorsText = selectedImport.ignoredErrorsCount + ' errors ignored';

    expect(screen.getByText(startedTimeText)).toBeVisible();
    expect(screen.getByText(stoppedTimeText)).toBeVisible();
    expect(screen.getByText(upToDateItemsText)).toBeVisible();
    expect(screen.getByText(addedItemsText)).toBeVisible();
    expect(screen.getByText(updatedItemsText)).toBeVisible();
    expect(screen.getByText(retiredItemsText)).toBeVisible();
    expect(screen.getByText(errorItemsText)).toBeVisible();
    expect(screen.getByText(ignoredErrorsText)).toBeVisible();
  });

  it('renders the import details when there are errored items', async () => {
    const selectedImport = mockPreviousImports[1];

    renderImportOverviewComponent(selectedImport);
    await waitForLoadingToFinish();

    const startedTimeText = formatDatetime(selectedImport.localDateStarted);
    const stoppedTimeText = formatDatetime(selectedImport.localDateStopped);
    const upToDateItemsText = selectedImport.upToDateItemsCount + ' concepts up to date';
    const addedItemsText = selectedImport.addedItemsCount + ' concepts added';
    const updatedItemsText = selectedImport.updatedItemsCount + ' concepts updated';
    const retiredItemsText = selectedImport.retiredItemsCount + ' concepts retired';
    const errorItemsText = selectedImport.errorItemsCount + ' errors found';
    const ignoredErrorsText = selectedImport.ignoredErrorsCount + ' errors ignored';

    expect(screen.getByText(startedTimeText)).toBeVisible();
    expect(screen.getByText(stoppedTimeText)).toBeVisible();
    expect(screen.getByText(upToDateItemsText)).toBeVisible();
    expect(screen.getByText(addedItemsText)).toBeVisible();
    expect(screen.getByText(updatedItemsText)).toBeVisible();
    expect(screen.getByText(retiredItemsText)).toBeVisible();
    expect(screen.getByText(errorItemsText)).toBeVisible();
    expect(screen.getByText(ignoredErrorsText)).toBeVisible();
  });
});

function renderImportOverviewComponent(importObject: Import) {
  renderWithSwr(<ImportOverview selectedImportObject={importObject} />);
}

function waitForLoadingToFinish() {
  return waitFor(() => {
    expect(screen.getByText('Started on')).toBeVisible();
  });
}
