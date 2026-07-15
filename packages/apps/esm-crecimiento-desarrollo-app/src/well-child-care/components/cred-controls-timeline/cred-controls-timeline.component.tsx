import { ClickableTile, Tile } from '@carbon/react';
import { useConfig, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgeRange, ConfigObject } from '../../../config-schema';
import { credCourseLifeEditPrivilege } from '../../../constants';
import { useAgeGroups } from '../../../hooks/useAgeGroups';
import { type CREDControlWithStatus, useCREDSchedule } from '../../../hooks/useCREDSchedule';
import { canRegisterCREDControlFromAgeGroup } from '../../../utils/cred-age-group-actions';
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
  const { getAgeGroupForDisplay } = useAgeGroups();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeRange | null>(null);
  const launchControlWorkspace = useLaunchWorkspaceRequiringVisit<{
    workspaceTitle: string;
    patientUuid: string;
    ageGroup: AgeRange;
    control: CREDControlWithStatus;
    type: 'ageGroup';
  }>(patientUuid, 'wellchild-control-form');

  const currentAgeGroup = useMemo(() => {
    return patient?.birthDate ? getAgeGroupForDisplay(patient.birthDate) : null;
  }, [getAgeGroupForDisplay, patient?.birthDate]);

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

  const handleAgeGroupClick = (group: AgeRange) => {
    if (!canRegisterCREDControlFromAgeGroup(group.label, currentAgeGroup?.label, controls)) return;

    const control = controls.find(
      (candidate) =>
        candidate.ageGroupLabel === group.label && candidate.status !== 'completed' && candidate.status !== 'scheduled',
    );

    if (!control) return;

    setSelectedAgeGroup(group);
    launchControlWorkspace({
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
          const hasAvailableControl = canRegisterCREDControlFromAgeGroup(group.label, currentAgeGroup?.label, controls);
          const tileClassName = classNames(styles.ageTile, {
            [styles.active]: isSelected,
            [styles.current]: isCurrent,
            [styles.neonatal]: group.neonatalControl,
            [styles.groupCompleted]: allCompleted,
            [styles.groupOverdue]: hasOverdue,
            [styles.actionable]: canEdit && hasAvailableControl,
          });
          const tileContent = (
            <>
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
            </>
          );

          return canEdit && hasAvailableControl ? (
            <ClickableTile key={group.label} className={tileClassName} onClick={() => handleAgeGroupClick(group)}>
              {tileContent}
            </ClickableTile>
          ) : (
            <Tile key={group.label} className={tileClassName}>
              {tileContent}
            </Tile>
          );
        })}
      </div>
    </div>
  );
};

export default CredAgeGroups;
