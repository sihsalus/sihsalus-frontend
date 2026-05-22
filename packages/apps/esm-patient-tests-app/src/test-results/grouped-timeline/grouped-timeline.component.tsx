import { showModal } from '@openmrs/esm-framework';
import { EmptyState, type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FilterContext from '../filter/filter-context';
import { makeThrottled } from '../helpers';
import { Grid, ShadowBox } from '../panel-timeline/helpers';
import styles from './grouped-timeline.scss';
import type {
  DataRowsProps,
  DateHeaderGridProps,
  NewRowStartCellProps,
  PanelNameCornerProps,
  TimelineCellProps,
  TimelineDataGroupProps,
} from './grouped-timeline-types';

const TimeSlots: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}> = ({ children = undefined, className, ...props }) => (
  <div className={classNames(styles.timeSlotInner, className)} {...props}>
    <div>{children}</div>
  </div>
);

const PanelNameCorner: React.FC<PanelNameCornerProps> = ({ showShadow, panelName }) => (
  <TimeSlots className={classNames(styles.cornerGridElement, { [styles.shadow]: showShadow })}>{panelName}</TimeSlots>
);

const NewRowStartCell: React.FC<NewRowStartCellProps> = ({
  title,
  range,
  units,
  conceptUuid,
  patientUuid,
  shadow = false,
  isString = false,
}) => {
  const handleLaunchResultsModal = useCallback(() => {
    const dispose = showModal('timeline-results-modal', {
      closeDeleteModal: () => dispose(),
      patientUuid,
      testUuid: conceptUuid,
      title,
    });
  }, [patientUuid, conceptUuid, title]);

  return (
    <div
      className={styles.rowStartCell}
      style={{
        boxShadow: shadow ? '8px 0 20px 0 rgba(0,0,0,0.15)' : undefined,
      }}
    >
      <span className={styles['trendline-link']}>
        {!isString ? (
          <span
            className={styles['trendline-link-view']}
            onClick={handleLaunchResultsModal}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleLaunchResultsModal();
              }
            }}
            role="button"
            tabIndex={0}
          >
            {title}
          </span>
        ) : (
          <span className={styles.trendlineLink}>{title}</span>
        )}
      </span>
      <span className={styles.rangeUnits}>
        {range} {units}
      </span>
    </div>
  );
};

const interpretationToCSS = {
  OFF_SCALE_HIGH: 'offScaleHigh',
  CRITICALLY_HIGH: 'criticallyHigh',
  HIGH: 'high',
  OFF_SCALE_LOW: 'offScaleLow',
  CRITICALLY_LOW: 'criticallyLow',
  LOW: 'low',
  NORMAL: '',
};

const TimelineCell: React.FC<TimelineCellProps> = ({ text, interpretation = 'NORMAL', zebra }) => {
  const interpretationClass = interpretationToCSS[interpretation];
  const additionalClassname: string = interpretationClass
    ? classNames(styles[interpretationClass], interpretationClass)
    : '';

  return (
    <div className={classNames(styles.timelineDataCell, { [styles.timelineCellZebra]: zebra }, additionalClassname)}>
      <p>{text}</p>
    </div>
  );
};

const GridItems = React.memo<{
  sortedTimes: Array<string>;
  obs: Array<{ value: string; interpretation?: OBSERVATION_INTERPRETATION } | undefined>;
  zebra: boolean;
}>(({ sortedTimes, obs, zebra }) => (
  <>
    {sortedTimes.map((_, i) => {
      if (!obs[i]) {
        return <TimelineCell key={i} text={''} zebra={zebra} />;
      }

      return <TimelineCell key={i} text={obs[i].value} interpretation={obs[i].interpretation} zebra={zebra} />;
    })}
  </>
));

const DataRows: React.FC<DataRowsProps> = ({ patientUuid, timeColumns, rowData, sortedTimes, showShadow }) => {
  return (
    <Grid dataColumns={timeColumns.length} padding style={{ gridColumn: 'span 2' }}>
      {rowData.map((row, index) => {
        const obs = row.entries;
        const { units = '', range = '', obs: values } = row;
        const isString = Number.isNaN(Number.parseFloat(values?.[0]?.value));
        return (
          <React.Fragment key={index}>
            <NewRowStartCell
              {...{
                units,
                range,
                title: row.display,
                shadow: showShadow,
                conceptUuid: row.conceptUuid,
                patientUuid,
                isString,
              }}
            />
            <GridItems {...{ sortedTimes, obs, zebra: !!(index % 2) }} />
          </React.Fragment>
        );
      })}
    </Grid>
  );
};

const DateHeaderGrid: React.FC<DateHeaderGridProps> = ({
  timeColumns,
  yearColumns,
  dayColumns,
  showShadow,
  xScroll,
  setXScroll,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const el: HTMLElement | null = ref.current;

  if (el) {
    el.scrollLeft = xScroll;
  }

  const handleScroll = useCallback(
    (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLDivElement) {
        setXScroll(target.scrollLeft);
      }
    },
    [setXScroll],
  );

  useEffect(() => {
    const div: HTMLElement | null = ref.current;
    if (div) {
      div.addEventListener('scroll', handleScroll);
      return () => div.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return (
    <div ref={ref} style={{ overflowX: 'auto' }} className={styles.dateHeaderInner}>
      <Grid
        dataColumns={timeColumns.length}
        style={{
          gridTemplateRows: 'repeat(3, 24px)',
          zIndex: 2,
          boxShadow: showShadow ? '8px 0 20px 0 rgba(0,0,0,0.15)' : undefined,
        }}
      >
        {yearColumns.map(({ year, size }) => {
          return (
            <TimeSlots key={year} className={styles.yearColumn} style={{ gridColumn: `${size} span` }}>
              {year}
            </TimeSlots>
          );
        })}
        {dayColumns.map(({ day, year, size }) => {
          return (
            <TimeSlots key={`${day} - ${year}`} className={styles.dayColumn} style={{ gridColumn: `${size} span` }}>
              {day}
            </TimeSlots>
          );
        })}
        {timeColumns.map((time, i) => {
          return (
            <TimeSlots key={time + i} className={styles.timeColumn}>
              {time}
            </TimeSlots>
          );
        })}
      </Grid>
    </div>
  );
};

const TimelineDataGroup: React.FC<TimelineDataGroupProps> = ({
  patientUuid,
  parent,
  subRows,
  xScroll,
  setXScroll,
  panelName,
  setPanelName,
  groupNumber,
}) => {
  const { timelineData } = useContext(FilterContext);
  const {
    data: {
      parsedTime: { timeColumns, sortedTimes },
    },
  } = timelineData;

  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (el) {
      el.scrollLeft = xScroll;
    }
  }, [xScroll]);

  useEffect(() => {
    if (groupNumber === 1 && panelName === '') {
      setPanelName(parent.display);
    }
  }, [groupNumber, panelName, parent.display, setPanelName]);

  useEffect(() => {
    const handleScroll = makeThrottled((event: Event) => {
      const target = event.target;
      if (target instanceof HTMLDivElement) {
        setXScroll(target.scrollLeft);
      }
    }, 200);

    const div: HTMLElement | null = ref.current;
    if (div) {
      div.addEventListener('scroll', handleScroll);
      return () => div.removeEventListener('scroll', handleScroll);
    }
  }, [setXScroll]);

  return (
    <>
      <div>
        {groupNumber > 1 && (
          <div className={styles.rowHeader}>
            <h6 ref={titleRef}>{parent.display}</h6>
          </div>
        )}
        <div className={styles.gridContainer} ref={ref}>
          <DataRows
            {...{
              patientUuid,
              timeColumns,
              rowData: subRows,
              sortedTimes,
              showShadow: Boolean(xScroll),
            }}
          />
          <ShadowBox />
        </div>
      </div>
    </>
  );
};

export const GroupedTimeline: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { activeTests, timelineData, parents, checkboxes, someChecked, lowestParents } = useContext(FilterContext);
  const [panelName, setPanelName] = useState('');
  const [xScroll, setXScroll] = useState(0);
  const { t } = useTranslation();
  let shownGroups = 0;

  const {
    data: {
      parsedTime: { yearColumns, dayColumns, timeColumns },
      rowData,
    },
    loaded,
  } = timelineData;

  useEffect(() => {
    setPanelName('');
  }, []);

  if (rowData && rowData?.length === 0) {
    return <EmptyState displayText={t('data', 'data')} headerTitle={t('dataTimelineText', 'Data timeline')} />;
  }

  if (activeTests && timelineData && loaded) {
    return (
      <div className={styles.timelineHeader}>
        <div className={styles.nestedTimelineHeader}>
          <div className={styles.dateHeaderContainer}>
            <PanelNameCorner showShadow={true} panelName={panelName} />
            <DateHeaderGrid
              {...{
                timeColumns,
                yearColumns,
                dayColumns,
                showShadow: true,
                xScroll,
                setXScroll,
              }}
            />
          </div>
        </div>
        <div className={styles.timelineDataContainer}>
          {lowestParents?.map((parent, index) => {
            if (parents[parent.flatName].some((kid) => checkboxes[kid]) || !someChecked) {
              shownGroups += 1;
              const subRows = someChecked
                ? rowData?.filter(
                    (row: { flatName: string }) =>
                      parents[parent.flatName].includes(row.flatName) && checkboxes[row.flatName],
                  )
                : rowData?.filter((row: { flatName: string }) => parents[parent.flatName].includes(row.flatName));

              return (
                subRows?.length > 0 && (
                  <TimelineDataGroup
                    patientUuid={patientUuid}
                    parent={parent}
                    subRows={subRows}
                    key={index}
                    xScroll={xScroll}
                    setXScroll={setXScroll}
                    panelName={panelName}
                    setPanelName={setPanelName}
                    groupNumber={shownGroups}
                  />
                )
              );
            } else return null;
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default GroupedTimeline;
