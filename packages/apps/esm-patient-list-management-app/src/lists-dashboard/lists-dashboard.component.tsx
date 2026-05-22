import { Tab, TabList, Tabs } from '@carbon/react';
import { launchWorkspace2, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import classnames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAllPatientLists } from '../api/hooks';
import { type PatientListFilter, PatientListType } from '../api/types';
import Header from '../header/header.component';
import ListsTable from '../lists-table/lists-table.component';
import styles from './lists-dashboard.scss';

const TabIndices = {
  STARRED_LISTS: 0,
  SYSTEM_LISTS: 1,
  MY_LISTS: 2,
  ALL_LISTS: 3,
} as const;

function usePatientListFilterForCurrentTab(selectedTab: number) {
  const { t } = useTranslation();

  return useMemo<PatientListFilter>(() => {
    switch (selectedTab) {
      case TabIndices.STARRED_LISTS:
        return { isStarred: true, label: t('starred', 'starred') };
      case TabIndices.SYSTEM_LISTS:
        return { type: PatientListType.SYSTEM, label: t('systemDefined', 'system-defined') };
      case TabIndices.MY_LISTS:
        return { type: PatientListType.USER, label: t('userDefined', 'user-defined') };
      case TabIndices.ALL_LISTS:
      default:
        return { label: '' };
    }
  }, [selectedTab, t]);
}

const ListsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<number>(TabIndices.STARRED_LISTS);
  const patientListFilter = usePatientListFilterForCurrentTab(selectedTab);
  const { patientLists, isLoading, error, mutate } = useAllPatientLists(patientListFilter);
  const { search } = useLocation();
  const handleShowNewListOverlay = useCallback(() => {
    launchWorkspace2('patient-list-form-workspace', {
      onSuccess: mutate,
    });
  }, [mutate]);

  useEffect(() => {
    if (search) {
      handleShowNewListOverlay();
    }
  }, [handleShowNewListOverlay, search]);

  const user = useSession();

  const tableHeaders = [
    { id: 1, key: 'display', header: t('listName', 'List name') },
    { id: 2, key: 'type', header: t('listType', 'List type') },
    { id: 3, key: 'size', header: t('noOfPatients', 'No. of patients') },
    { id: 4, key: 'isStarred', header: '' },
  ];

  return (
    <AppErrorBoundary
      appName="esm-patient-list-management-app"
      checkAccess={true}
      privilegesRequired={['Get Queue Entries']}
      user={user}
    >
      <main className={classnames('omrs-main-content', styles.dashboardContainer)}>
        <section className={styles.dashboard}>
          <Header handleShowNewListOverlay={handleShowNewListOverlay} />
          <div className={styles.tabsContainer}>
            <div className={styles.tabs}>
              <Tabs
                onChange={({ selectedIndex }) => {
                  setSelectedTab(selectedIndex);
                }}
                selectedIndex={selectedTab}
              >
                <TabList className={styles.tablist} aria-label="List tabs" contained>
                  <Tab className={styles.tab}>{t('starredLists', 'Starred lists')}</Tab>
                  <Tab className={styles.tab}>{t('systemLists', 'System lists')}</Tab>
                  <Tab className={styles.tab}>{t('myLists', 'My lists')}</Tab>
                  <Tab className={styles.tab}>{t('allLists', 'All lists')}</Tab>
                </TabList>
              </Tabs>
            </div>
            <div className={styles.listsTableContainer}>
              <ListsTable
                error={error}
                headers={tableHeaders}
                isLoading={isLoading}
                key={patientListFilter.label}
                listType={patientListFilter.label}
                patientLists={patientLists}
                refetch={mutate}
              />
            </div>
          </div>
        </section>
      </main>
    </AppErrorBoundary>
  );
};

export default ListsDashboard;
