import { OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { showModal, showSnackbar } from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { downloadCSV } from '../../../cohort-builder.utils';
import type { Cohort, SearchHistoryItem } from '../../../types';
import type { SaveQueryFormData } from './save-query.modal';
import { createCohort, createQuery } from './search-history-options.resources';
import styles from './search-history-options.scss';

const Option = {
  DELETE: 'delete',
  DOWNLOAD: 'download',
  SAVE_COHORT: 'saveCohort',
  SAVE_QUERY: 'saveQuery',
} as const;

type OptionType = (typeof Option)[keyof typeof Option];

interface SearchHistoryOptions {
  searchItem: SearchHistoryItem;
  updateSearchHistory: (selectedSearchItem: SearchHistoryItem) => void;
}

const createCohortFromSearchItem = async (
  name: string,
  description: string,
  searchItem: SearchHistoryItem,
  t: TFunction,
) => {
  const cohortMembers = searchItem.memberIds ?? searchItem.patients.map((patient) => Number(patient.id));
  if (cohortMembers.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Invalid cohort membership.');
  }
  const cohort: Cohort = { display: name, name, description, memberIds: [...cohortMembers] };
  await createCohort(cohort);
  showSnackbar({
    title: t('success', 'Success'),
    kind: 'success',
    isLowContrast: true,
    subtitle: t('cohortSaved', 'Cohort created successfully'),
  });
};

const SearchHistoryOptions: React.FC<SearchHistoryOptions> = ({ searchItem, updateSearchHistory }) => {
  const { t } = useTranslation();

  const handleOption = (option: OptionType) => {
    const { patients, description } = searchItem;
    switch (option) {
      case Option.SAVE_COHORT:
        launchSaveCohortModal();
        break;
      case Option.SAVE_QUERY:
        launchSaveQueryModal();
        break;
      case Option.DOWNLOAD:
        downloadCSV(patients, description);
        break;
      case Option.DELETE:
        launchClearItemFromSearchHistoryModal();
        break;
    }
  };

  const handleDeleteSearchItem = async () => {
    try {
      updateSearchHistory(searchItem);
      showSnackbar({
        title: t('success', 'Success'),
        kind: 'success',
        isLowContrast: true,
        subtitle: t('searchItemDeleted', 'The search was removed from history'),
      });
    } catch {
      showSnackbar({
        title: t('searchItemDeleteError', 'Error deleting the cohort'),
        kind: 'error',
        isLowContrast: true,
        subtitle: t('searchHistoryChanged', 'The history has changed. Refresh it before trying again.'),
      });
    }
  };

  const handleSaveQuery = async ({ queryName, queryDescription }: SaveQueryFormData) => {
    if (!searchItem.parameters) throw new Error('The query definition is unavailable.');
    await createQuery({ ...searchItem.parameters, name: queryName, description: queryDescription });
    showSnackbar({
      title: t('success', 'Success'),
      kind: 'success',
      isLowContrast: true,
      subtitle: t('querySaved', 'Query saved successfully'),
    });
  };

  const launchSaveQueryModal = () => {
    const dispose = showModal('save-query-modal', {
      closeModal: () => dispose(),
      onSaveQuery: handleSaveQuery,
      size: 'sm',
    });
  };

  const launchClearItemFromSearchHistoryModal = () => {
    const dispose = showModal('clear-item-from-search-history-modal', {
      closeModal: () => dispose(),
      onRemove: handleDeleteSearchItem,
      searchItemName: searchItem?.description,
      size: 'sm',
    });
  };

  const launchSaveCohortModal = () => {
    const dispose = showModal('save-cohort-modal', {
      closeModal: () => dispose(),
      onSave: (name: string, description: string) => createCohortFromSearchItem(name, description, searchItem, t),
      size: 'sm',
    });
  };

  return (
    <OverflowMenu
      aria-label={t('searchHistoryOptions', 'Search history options')}
      size="md"
      flipped
      direction="top"
      data-testid="options"
    >
      <OverflowMenuItem
        className={styles.menuItem}
        data-testid="save-cohort"
        itemText={t('saveCohort', 'Save cohort')}
        onClick={() => handleOption(Option.SAVE_COHORT)}
      />
      <OverflowMenuItem
        className={styles.menuItem}
        data-testid="save-query"
        disabled={!searchItem.parameters}
        itemText={t('saveQuery', 'Save query')}
        onClick={() => handleOption(Option.SAVE_QUERY)}
      />
      <OverflowMenuItem
        className={styles.menuItem}
        itemText={t('downloadResults', 'Download results')}
        onClick={() => handleOption(Option.DOWNLOAD)}
      />
      <OverflowMenuItem
        className={styles.menuItem}
        data-testid="deleteFromHistory"
        hasDivider
        isDelete
        itemText={t('deleteFromHistory', 'Delete from history')}
        onClick={() => handleOption(Option.DELETE)}
      />
    </OverflowMenu>
  );
};

export default SearchHistoryOptions;
