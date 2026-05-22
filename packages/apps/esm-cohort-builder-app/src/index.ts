import { getSyncLifecycle } from '@openmrs/esm-framework';
import cohortBuilderComponent from './cohort-builder.component';
import cohortBuilderAdminPageCardLinkComponent from './cohort-builder-admin-link.component';
import cohortBuilderAppMenuItemComponent from './cohort-builder-app-menu-item.component';
import deleteCohortModalComponent from './components/saved-cohorts/saved-cohorts-options/delete-cohort.modal';
import deleteQueryModalComponent from './components/saved-queries/saved-queries-options/delete-query.modal';
import clearItemFromSearchHistoryModalComponent from './components/search-history/search-history-options/clear-item-from-search-history.modal';
import clearSearchHistoryModalComponent from './components/search-history/search-history-options/clear-search-history.modal';
import saveCohortModalComponent from './components/search-history/search-history-options/save-cohort.modal';
import saveQueryModalComponent from './components/search-history/search-history-options/save-query.modal';

const moduleName = '@sihsalus/esm-cohort-builder-app';

const options = {
  featureName: 'cohort-builder',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {}

export const cohortBuilder = getSyncLifecycle(cohortBuilderComponent, options);

export const cohortBuilderAppMenuItem = getSyncLifecycle(cohortBuilderAppMenuItemComponent, options);

export const cohortBuilderAdminPageCardLink = getSyncLifecycle(cohortBuilderAdminPageCardLinkComponent, options);

export const clearItemFromSearchHistoryModal = getSyncLifecycle(clearItemFromSearchHistoryModalComponent, options);

export const clearSearchHistoryModal = getSyncLifecycle(clearSearchHistoryModalComponent, options);

export const deleteCohortModal = getSyncLifecycle(deleteCohortModalComponent, options);

export const deleteQueryModal = getSyncLifecycle(deleteQueryModalComponent, options);

export const saveCohortModal = getSyncLifecycle(saveCohortModalComponent, options);

export const saveQueryModal = getSyncLifecycle(saveQueryModalComponent, options);
