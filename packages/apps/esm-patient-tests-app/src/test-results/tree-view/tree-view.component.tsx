import { AccordionSkeleton, Button, DataTableSkeleton, Layer } from '@carbon/react';
import { TreeViewAltIcon, useLayoutType } from '@openmrs/esm-framework';
import { EmptyState } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useContext, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type GroupedObservation, type viewOpts } from '../../types';
import FilterSet, { FilterContext } from '../filter';
import GroupedTimeline from '../grouped-timeline';
import IndividualResultsTable from '../individual-results-table/individual-results-table.component';
import usePanelData from '../panel-view/usePanelData';
import styles from '../results-viewer/results-viewer.scss';
import TabletOverlay from '../tablet-overlay';
import Trendline from '../trendline/trendline.component';

interface TreeViewProps {
  patientUuid: string;
  basePath: string;
  testUuid: string;
  isLoading: boolean;
  expanded: boolean;
  type: string;
  view?: viewOpts;
}

const GroupedPanelsTables: React.FC<{ className: string; loadingPanelData: boolean }> = ({
  className,
  loadingPanelData,
}) => {
  const { t } = useTranslation();
  const { checkboxes, someChecked, tableData } = useContext(FilterContext);

  const filteredTableData = useMemo(() => {
    if (!tableData?.length) return [];
    if (!someChecked) return tableData;

    return tableData
      .map((group) => {
        const filteredEntries = group.entries.filter((entry) => checkboxes[entry.flatName]);
        return {
          ...group,
          entries: filteredEntries,
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [tableData, checkboxes, someChecked]);

  if (!filteredTableData.length) {
    return <EmptyState displayText={t('data', 'data')} headerTitle={t('dataTimelineText', 'Data timeline')} />;
  }

  return (
    <Layer className={className}>
      {filteredTableData.map((subRows: GroupedObservation, index) => {
        return (
          <div
            key={index}
            className={classNames({
              [styles.border]: subRows.entries.length,
            })}
          >
            <IndividualResultsTable
              isLoading={loadingPanelData}
              subRows={subRows}
              index={index}
              title={subRows.key}
            />
          </div>
        );
      })}
    </Layer>
  );
};

const TreeView: React.FC<TreeViewProps> = ({ patientUuid, basePath, testUuid, isLoading, expanded, type, view }) => {
  const { t } = useTranslation();
  const tablet = useLayoutType() === 'tablet';
  const [showTreeOverlay, setShowTreeOverlay] = useState(false);

  const { timelineData, resetTree } = useContext(FilterContext);
  const { isLoading: isLoadingPanelData } = usePanelData();

  if (tablet) {
    return (
      <>
        <div>
          {!isLoading ? <GroupedTimeline patientUuid={patientUuid} /> : <DataTableSkeleton role="progressbar" />}
        </div>
        <div className={styles.floatingTreeButton}>
          <Button
            renderIcon={TreeViewAltIcon}
            hasIconOnly
            onClick={() => setShowTreeOverlay(true)}
            iconDescription={t('showTree', 'Show tree')}
          />
        </div>
        {showTreeOverlay && (
          <TabletOverlay
            headerText={t('tree', 'Tree')}
            close={() => setShowTreeOverlay(false)}
            buttonsGroup={
              <>
                <Button kind="secondary" size="xl" onClick={resetTree} disabled={isLoading}>
                  {t('resetTreeText', 'Reset tree')}
                </Button>
                <Button kind="primary" size="xl" onClick={() => setShowTreeOverlay(false)} disabled={isLoading}>
                  {`${t('view', 'View')} ${
                    !isLoading && timelineData?.loaded ? timelineData?.data?.rowData?.length : ''
                  } ${t('resultsText', 'results')}`}
                </Button>
              </>
            }
          >
            {!isLoading ? <FilterSet hideFilterSetHeader /> : <AccordionSkeleton open count={4} align="start" />}
          </TabletOverlay>
        )}
      </>
    );
  }

  return (
    <>
      {!expanded && (
        <div className={styles.leftSection}>
          {!isLoading ? <FilterSet /> : <AccordionSkeleton open count={4} align="start" />}
        </div>
      )}
      <div className={classNames(styles.rightSection, expanded ? styles.fullView : styles.splitView)}>
        {testUuid && type === 'trendline' ? (
          <Trendline patientUuid={patientUuid} conceptUuid={testUuid} basePath={basePath} showBackToTimelineButton />
        ) : isLoading || isLoadingPanelData ? (
          <DataTableSkeleton />
        ) : view === 'individual-test' ? (
          <div className={styles.panelViewTimeline}>
            <GroupedPanelsTables className={styles.groupPanelsTables} loadingPanelData={isLoading} />
          </div>
        ) : view === 'over-time' ? (
          <GroupedTimeline patientUuid={patientUuid} />
        ) : null}
      </div>
    </>
  );
};

export default TreeView;
