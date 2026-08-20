import {
  DataTable,
  Layer,
  Search,
  SkeletonPlaceholder,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Toggle,
} from '@carbon/react';
import {
  isDesktop,
  showSnackbar,
  syncDynamicOfflineData,
  useConnectivity,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { EmptyState } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Form } from '../types';

import {
  putDynamicFormDataEntryFor,
  removeDynamicFormDataEntryFor,
  useDynamicFormDataEntries,
} from './offline-form-helpers';
import styles from './offline-forms.scss';
import { useValidOfflineFormEncounters } from './use-offline-form-encounters';

export type OfflineFormsProps = Record<string, never>;

const OfflineForms: React.FC<OfflineFormsProps> = () => {
  const { t } = useTranslation();
  const session = useSession();
  const forms = useValidOfflineFormEncounters();
  const layout = useLayoutType();
  const canMarkFormsAsOffline = useConnectivity();
  const toolbarItemSize = isDesktop(layout) ? 'sm' : undefined;
  const headers = [
    { key: 'formName', header: t('offlineFormsTableFormNameHeader', 'Form name') },
    { key: 'availableOffline', header: t('offlineFormsTableFormAvailableOffline', 'Offline') },
  ];

  const rows = useMemo(() => {
    const filteredForms = forms?.data?.filter((formInfo) =>
      userHasAccess(formInfo?.encounterType?.editPrivilege?.display, session?.user),
    );

    const sortedForms = filteredForms
      ?.map((form) => ({
        id: form.uuid,
        formName: form.display,
        availableOffline: <OfflineFormToggle form={form} disabled={!canMarkFormsAsOffline} />,
      }))
      ?.sort((a, b) => a.formName.localeCompare(b.formName));

    return sortedForms ?? [];
  }, [forms.data, session.user, canMarkFormsAsOffline]);

  if (!forms.data && !forms.error) {
    return (
      <>
        <header className={styles.pageHeaderContainer}>
          <h1 className={styles.pageHeader}>{t('offlineFormsTitle', 'Offline forms')}</h1>
        </header>
        <main className={styles.contentContainer}>
          <SkeletonPlaceholder className={styles.availableOfflineToggleSkeleton} />
          <SkeletonPlaceholder className={styles.availableOfflineToggleSkeleton} />
          <SkeletonPlaceholder className={styles.availableOfflineToggleSkeleton} />
        </main>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.contentContainer}>
        <EmptyState
          displayText={t('offlineForms__lower', 'offline forms')}
          headerTitle={t('offlineForms', 'Offline forms')}
        />
      </div>
    );
  }

  return (
    <>
      <header className={styles.pageHeaderContainer}>
        <h1 className={styles.pageHeader}>{t('offlineFormsTitle', 'Offline forms')}</h1>
      </header>
      <main className={styles.contentContainer}>
        <DataTable rows={rows} headers={headers} size="sm" useZebraStyles>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getTableContainerProps, onInputChange }) => (
            <TableContainer {...getTableContainerProps()}>
              <div className={styles.tableHeaderContainer}>
                <Layer>
                  <Search
                    className={styles.tableSearch}
                    labelText={t('offlinePatientsTableSearchLabel', 'Search this list')}
                    placeholder={t('offlinePatientsTableSearchPlaceholder', 'Search this list')}
                    size={toolbarItemSize}
                    onChange={onInputChange}
                  />
                </Layer>
              </div>
              <Table {...getTableProps()} isSortable useZebraStyles>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })} isSortable>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value?.value ?? cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </main>
    </>
  );
};

export function OfflineFormToggle({ form, disabled }: { form: Form; disabled: boolean }) {
  const { t } = useTranslation();
  const session = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const dynamicFormEntriesSwr = useDynamicFormDataEntries(session?.user?.uuid);
  const isMarkedAsOffline = dynamicFormEntriesSwr.data?.some((entry) => entry.identifier === form.uuid);

  const handleToggled = async (checked: boolean) => {
    const userId = session?.user?.uuid;
    if (!userId) {
      return;
    }

    setIsUpdating(true);
    let updateFailed = false;

    try {
      if (checked) {
        await putDynamicFormDataEntryFor(userId, form.uuid);
        await syncDynamicOfflineData('form', form.uuid);
      } else {
        await removeDynamicFormDataEntryFor(userId, form.uuid);
      }
    } catch {
      updateFailed = true;
      if (checked) {
        // Do not leave a form marked as available offline when its required data
        // could not be downloaded. A later toggle can retry from a clean state.
        try {
          await removeDynamicFormDataEntryFor(userId, form.uuid);
        } catch {
          // The generic feedback below covers both the original failure and a
          // best-effort rollback failure without exposing technical details.
        }
      }

      showSnackbar({
        kind: 'error',
        title: t('offlineFormUpdateFailed', 'Offline form update failed'),
        subtitle: t(
          'offlineFormUpdateFailedSubtitle',
          "The form's offline availability could not be changed. Please try again.",
        ),
      });
    } finally {
      try {
        await dynamicFormEntriesSwr.mutate();
      } catch {
        if (!updateFailed) {
          showSnackbar({
            kind: 'warning',
            title: t('offlineFormStatusRefreshFailed', 'Offline form status could not be refreshed'),
            subtitle: t(
              'offlineFormStatusRefreshFailedSubtitle',
              'The update completed, but this page may be out of date. Reload it before taking another action.',
            ),
          });
        }
      }
      setIsUpdating(false);
    }
  };

  if (dynamicFormEntriesSwr.isValidating) {
    // ^ Using an explicit undefined check since 'data' is a bool. We want to handle false separately.
    return <SkeletonPlaceholder className={styles.availableOfflineToggleSkeleton} />;
  }

  return (
    <div>
      <Toggle
        aria-label={t('offlineToggle', 'Offline toggle')}
        id={`${form.uuid}-offline-toggle`}
        className={styles.availableOfflineToggle}
        labelA=""
        labelB=""
        labelText=""
        size="sm"
        toggled={isMarkedAsOffline}
        disabled={disabled || isUpdating || dynamicFormEntriesSwr.isValidating}
        onToggle={handleToggled}
      />
    </div>
  );
}

export default OfflineForms;
