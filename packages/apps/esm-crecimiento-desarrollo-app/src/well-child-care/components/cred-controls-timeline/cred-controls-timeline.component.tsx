import { Tile } from '@carbon/react';
import { launchWorkspace2, useConfig, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import classNames from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credCourseLifeEditPrivilege } from '../../../constants';
import { useCREDSchedule } from '../../../hooks/useCREDSchedule';
import { translateCredAgeGroupLabel, translateCredAgeGroupSublabel } from '../../../utils/cred-label-translations';

import styles from './cred-schedule.scss';

interface CredAgeGroupsProps {
  patientUuid: string;
}

const CredAgeGroups: React.FC<CredAgeGroupsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { ageGroupsCRED } = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(credCourseLifeEditPrivilege, session?.user);
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const { controls } = useCREDSchedule(patientUuid);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<(typeof ageGroupsCRED)[0] | null>(null);

  const patientAge = useMemo(() => {
    if (!patient?.birthDate) return { inDays: 0, inMonths: 0 };
    const birthDate = dayjs(patient.birthDate);
    const today = dayjs();
    return {
      inDays: today.diff(birthDate, 'days'),
      inMonths: today.diff(birthDate, 'months'),
    };
  }, [patient]);

  const currentAgeGroup = useMemo(() => {
    return ageGroupsCRED.find((group) => {
      const inDayRange =
        group.minDays !== undefined &&
        group.maxDays !== undefined &&
        patientAge.inDays >= group.minDays &&
        patientAge.inDays <= group.maxDays;
      const inMonthRange =
        group.minMonths !== undefined &&
        group.maxMonths !== undefined &&
        patientAge.inMonths >= group.minMonths &&
        patientAge.inMonths <= group.maxMonths;
      return inDayRange || inMonthRange;
    });
  }, [patientAge, ageGroupsCRED]);

  // Compute status summary per age group
  const groupStatusSummary = useMemo(() => {
    const summary: Record<string, { completed: number; overdue: number; total: number }> = {};

    ageGroupsCRED.forEach((group) => {
      summary[group.label] = { completed: 0, overdue: 0, total: 0 };
    });

    controls.forEach((control) => {
      const s = summary[control.ageGroupLabel];
      if (s) {
        s.total++;
        if (control.status === 'completed') s.completed++;
        if (control.status === 'overdue') s.overdue++;
      }
    });

    return summary;
  }, [controls, ageGroupsCRED]);

  const handleAgeGroupClick = (group) => {
    const control = controls.find(
      (candidate) =>
        candidate.ageGroupLabel === group.label && candidate.status !== 'completed' && candidate.status !== 'scheduled',
    );

    if (!control) return;

    setSelectedAgeGroup(group);
    launchWorkspace2('wellchild-control-form', {
      workspaceTitle: `${t('ageGroupDetails', 'Control Crecimiento y Desarrollo - Grupo Etario')} - ${translateCredAgeGroupLabel(t, group.label)}`,
      patientUuid,
      ageGroup: group,
      control,
      type: 'ageGroup',
    });
  };

  if (isPatientLoading) return <div>{t('loadingPatient', 'Cargando paciente...')}</div>;
  if (patientError)
    return <p className={styles.error}>{t('errorLoadingPatient', 'Error cargando los datos del paciente.')}</p>;

  return (
    <div className={styles.widgetCard}>
      <div className={styles.desktopHeading}>
        <h4>{t('credAgeGroups', 'Control Según Edad')}</h4>
      </div>
      <div className={styles.ageGroups}>
        {ageGroupsCRED.map((group) => {
          const summary = groupStatusSummary[group.label];
          const isCurrent = currentAgeGroup?.label === group.label;
          const isSelected = selectedAgeGroup?.label === group.label;
          const allCompleted = summary && summary.total > 0 && summary.completed === summary.total;
          const hasOverdue = summary && summary.overdue > 0;
          const hasAvailableControl = controls.some(
            (control) =>
              control.ageGroupLabel === group.label && control.status !== 'completed' && control.status !== 'scheduled',
          );

          return (
            <Tile
              key={group.label}
              className={classNames(styles.ageTile, {
                [styles.active]: isSelected,
                [styles.current]: isCurrent,
                [styles.neonatal]: group.neonatalControl,
                [styles.groupCompleted]: allCompleted,
                [styles.groupOverdue]: hasOverdue,
              })}
              onClick={canEdit && hasAvailableControl ? () => handleAgeGroupClick(group) : undefined}
            >
              <strong>{translateCredAgeGroupLabel(t, group.label)}</strong>
              {group.sublabel && <div>{translateCredAgeGroupSublabel(t, group.sublabel)}</div>}
              {summary && summary.total > 0 && (
                <div className={styles.groupStatus}>
                  {summary.completed}/{summary.total}
                </div>
              )}
              {hasOverdue && (
                <div className={styles.overdueIndicator}>
                  {t('overdueShort', '{{count}} venc.', {
                    count: summary.overdue,
                  })}
                </div>
              )}
            </Tile>
          );
        })}
      </div>
    </div>
  );
};

export default CredAgeGroups;
