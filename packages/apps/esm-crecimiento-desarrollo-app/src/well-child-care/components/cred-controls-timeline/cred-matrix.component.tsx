import { DataTableSkeleton } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../config-schema';
import { type CREDControlWithStatus, useCREDSchedule } from '../../../hooks/useCREDSchedule';
import {
  translateCredAgeGroupLabel,
  translateCredAgeGroupSublabel,
  translateCredControlLabel,
} from '../../../utils/cred-label-translations';

import styles from './cred-matrix.scss';
import CredTile from './cred-tile';

interface CredControlsMatrixProps {
  patientUuid: string;
}

const CredControlsMatrix: React.FC<CredControlsMatrixProps> = ({ patientUuid }) => {
  const { ageGroupsCRED } = useConfig<ConfigObject>();
  const { controls, completedCount, totalCount, overdueControls, isLoading, error } = useCREDSchedule(patientUuid);
  const { t } = useTranslation();

  const headerTitle = t('controlsAndAtentions', 'Atenciones y controles');

  const groupedControls = useMemo(() => {
    const grouped: Record<string, CREDControlWithStatus[]> = {};

    ageGroupsCRED.forEach((group) => {
      grouped[group.label] = [];
    });

    controls.forEach((control) => {
      if (grouped[control.ageGroupLabel]) {
        grouped[control.ageGroupLabel].push(control);
      }
    });

    return grouped;
  }, [controls, ageGroupsCRED]);

  if (isLoading) return <DataTableSkeleton size="sm" zebra />;
  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <div className={styles.clinicalDataHeaderActionItems}>
          <span className={styles.summaryItem}>
            {t('completedOf', '{{completed}} de {{total}} controles', {
              completed: completedCount,
              total: totalCount,
            })}
          </span>
          {overdueControls.length > 0 && (
            <span className={styles.overdueCount}>
              {t('overdueCount', '{{count}} vencidos', { count: overdueControls.length })}
            </span>
          )}
        </div>
      </CardHeader>
      <div className={styles.matrixScroll}>
        <div className={styles.matrixGrid}>
          {ageGroupsCRED.map((group) => {
            const groupControls = groupedControls[group.label] ?? [];
            return (
              <div key={group.label} className={styles.matrixColumn}>
                <div className={styles.columnHeader}>
                  <strong>{translateCredAgeGroupLabel(t, group.label)}</strong>
                  {group.sublabel && (
                    <div className={styles.sublabel}>{translateCredAgeGroupSublabel(t, group.sublabel)}</div>
                  )}
                </div>
                <div className={styles.columnBody}>
                  {groupControls.map((control) => (
                    <CredTile
                      key={control.controlNumber}
                      uuid={control.encounterUuid}
                      controlNumber={control.controlNumber}
                      label={translateCredControlLabel(t, control.label)}
                      date={control.encounterDate ?? control.appointmentDate ?? control.targetDate}
                      status={control.status}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CredControlsMatrix;
