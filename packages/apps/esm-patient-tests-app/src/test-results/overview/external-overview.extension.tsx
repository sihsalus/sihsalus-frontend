import { Button, DataTableSkeleton } from '@carbon/react';
import { ArrowRightIcon, navigate } from '@openmrs/esm-framework';
import {
  EmptyState,
  type ExternalOverviewProps,
  type PanelFilterProps,
  type PatientData,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import usePatientResultsData from '../loadPatientTestData/usePatientResultsData';
import { type PatientResultsData } from '../loadPatientTestData/loadPatientData';
import ResultsLoadError from './results-load-error.component';

import CommonOverview from './common-overview.component';
import styles from './external-overview.scss';
import { type OverviewPanelEntry, parseSingleEntry } from './useOverviewData';

const resultsToShow = 3;

function getFilteredOverviewData(sortedObs: PatientResultsData, filter: (filterProps: PanelFilterProps) => boolean) {
  return Object.values(sortedObs)
    .flatMap(({ name: panelName, entries, type, uuid }) => {
      return entries.map((e) => [e, uuid, type, panelName] as PanelFilterProps);
    })
    .filter(filter)
    .map(([entry, uuid, type, panelName]: PanelFilterProps): OverviewPanelEntry => {
      return [
        panelName,
        type,
        parseSingleEntry(entry, type as PatientData[string]['type'], panelName),
        new Date(entry.effectiveDateTime),
        new Date(entry.issued ?? entry.effectiveDateTime),
        uuid,
      ];
    })
    .sort(([, , , date1], [, , , date2]) => date2.getTime() - date1.getTime());
}

function useFilteredOverviewData(patientUuid: string, filter: (filterProps: PanelFilterProps) => boolean = () => true) {
  const { sortedObs, loaded, error, isOffline, retry } = usePatientResultsData(patientUuid);

  const overviewData = useMemo(() => getFilteredOverviewData(sortedObs, filter), [filter, sortedObs]);

  return { overviewData, loaded, error, isOffline, retry };
}

const ExternalOverview: React.FC<ExternalOverviewProps> = ({ patientUuid, filter }) => {
  const { t } = useTranslation();
  const { overviewData, loaded, error, isOffline, retry } = useFilteredOverviewData(patientUuid, filter);

  const cardTitle = t('recentResults', 'Recent Results');
  const handleSeeAll = useCallback(() => {
    navigate({ to: `\${openmrsSpaBase}/patient/${patientUuid}/chart/Results` });
  }, [patientUuid]);

  return (
    <RecentResultsGrid>
      {error || isOffline ? (
        <ResultsLoadError retry={retry} isOffline={isOffline} />
      ) : loaded ? (
        <>
          {(() => {
            if (overviewData.length) {
              return (
                <div className={styles.widgetCard}>
                  <div className={styles.externalOverviewHeader}>
                    <h4 className={classNames(styles.productiveHeading03, styles.text02)}>{cardTitle}</h4>
                    <Button kind="ghost" onClick={retry}>
                      {t('refreshData', 'Refresh data')}
                    </Button>
                    <Button
                      kind="ghost"
                      renderIcon={(props: ComponentProps<typeof ArrowRightIcon>) => (
                        <ArrowRightIcon size={16} {...props} />
                      )}
                      iconDescription={t('seeAllResults', 'See all results')}
                      onClick={handleSeeAll}
                    >
                      {t('seeAllResults', 'See all results')}
                    </Button>
                  </div>
                  <CommonOverview
                    {...{
                      patientUuid,
                      overviewData: overviewData.slice(0, resultsToShow),
                      insertSeparator: true,
                      deactivateToolbar: true,
                      isPatientSummaryDashboard: false,
                      hideToolbar: true,
                    }}
                  />
                  {overviewData.length > resultsToShow && (
                    <Button onClick={handleSeeAll} kind="ghost">
                      {t('moreResultsAvailable', 'More results available')}
                    </Button>
                  )}
                </div>
              );
            } else {
              return <EmptyState headerTitle={cardTitle} displayText={t('recentTestResults', 'recent test results')} />;
            }
          })()}
        </>
      ) : (
        <DataTableSkeleton columnCount={3} />
      )}
    </RecentResultsGrid>
  );
};

export default ExternalOverview;

const RecentResultsGrid: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => {
  return <div {...props} className={styles['recent-results-grid']} />;
};
