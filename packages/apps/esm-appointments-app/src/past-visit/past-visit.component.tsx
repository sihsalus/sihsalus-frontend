import { StructuredListSkeleton, Tab, Tabs } from '@carbon/react';
import { formatDate, type OpenmrsResource, parseDate, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Observation } from '../types';

import EncounterList from './encounter-list.component';
import { usePastVisits } from './past-visit.resource';
import styles from './past-visit.scss';

interface PastVisitProps {
  patientUuid: string;
}

export interface FormattedEncounter {
  id: string;
  datetime: string;
  encounterType: string;
  form: OpenmrsResource;
  obs: Array<Observation>;
  provider: string;
  visitType: string;
  visitUuid: string;
}

const PastVisit: React.FC<PastVisitProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { data: pastVisits, isLoading } = usePastVisits(patientUuid);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const isTablet = useLayoutType() === 'tablet';

  if (isLoading) {
    return <StructuredListSkeleton />;
  }

  if (pastVisits?.length) {
    const encounters = mapEncounters(pastVisits[0]);

    const tabsClasses = classNames(styles.verticalTabs, {
      [styles.tabletTabs]: isTablet,
      [styles.desktopTabs]: !isTablet,
    });

    const tabClass = (index) =>
      classNames(styles.tab, styles.bodyLong01, {
        [styles.selectedTab]: selectedTabIndex === index,
      });

    return (
      <div className={styles.wrapper}>
        <div className={styles.visitType}>
          <span> {pastVisits?.length ? pastVisits[0]?.visitType.display : '--'}</span>
          <p className={styles.date}>
            {pastVisits?.length ? formatDate(parseDate(pastVisits[0]?.startDatetime)) : '--'}
          </p>
        </div>
        <div className={styles.visitContainer}>
          <div className={tabsClasses}>
            <Tabs>
              <Tab className={tabClass(0)} id="vitals-tab" onClick={() => setSelectedTabIndex(0)}>
                {t('vitals', 'Vitals')}
              </Tab>

              <Tab className={tabClass(1)} id="notes-tab" onClick={() => setSelectedTabIndex(1)}>
                {t('notes', 'Notes')}
              </Tab>

              <Tab className={tabClass(2)} id="medications-tab" onClick={() => setSelectedTabIndex(2)}>
                {t('medications', 'Medications')}
              </Tab>

              <Tab className={tabClass(3)} id="encounters-tab" onClick={() => setSelectedTabIndex(3)}>
                {t('encounters', 'Encounters')}
                <EncounterList encounters={encounters} />
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }
  return <p className={styles.bodyLong01}>{t('noPreviousVisitFound', 'No previous visit found')}</p>;
};

export function mapEncounters(visit) {
  return visit?.encounters?.map((encounter) => ({
    id: encounter?.uuid,
    datetime: encounter?.encounterDatetime,
    encounterType: encounter?.encounterType?.display,
    form: encounter?.form,
    obs: encounter?.obs,
    provider:
      encounter?.encounterProviders?.length > 0 ? encounter.encounterProviders[0].provider?.person?.display : '--',
    visitUuid: visit?.visitType.uuid,
    visitType: visit?.visitType?.name,
  }));
}

export default PastVisit;
