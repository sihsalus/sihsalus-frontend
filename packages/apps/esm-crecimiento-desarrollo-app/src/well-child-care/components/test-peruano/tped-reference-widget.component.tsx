import { Select, SelectItem, Tag } from '@carbon/react';
import { WarningAltFilled } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateTpedChronologicalMonthAtDate,
  getEffectiveTpedMilestone,
  resolveTpedEvaluationAgeColumn,
  TPED_AGE_COLUMNS,
  TPED_DEFINITION,
  type TpedAgeColumn,
} from '../../test-peruano';
import TpedMatrix, { type TpedSelectedCell } from './tped-matrix.component';
import TpedMilestoneDetail from './tped-milestone-detail.component';
import styles from './tped-reference-widget.scss';

interface TpedReferenceWidgetProps {
  evaluationDate?: string;
  patientUuid: string;
}

function getLocalIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TpedReferenceWidget: React.FC<TpedReferenceWidgetProps> = ({ evaluationDate, patientUuid }) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const effectiveEvaluationDate = evaluationDate ?? getLocalIsoDate();
  const chronologicalMonth = useMemo(
    () =>
      patient?.birthDate ? calculateTpedChronologicalMonthAtDate(patient.birthDate, effectiveEvaluationDate) : null,
    [effectiveEvaluationDate, patient?.birthDate],
  );
  const patientAgeColumn = chronologicalMonth === null ? null : resolveTpedEvaluationAgeColumn(chronologicalMonth);
  const [focusedAgeColumn, setFocusedAgeColumn] = useState<TpedAgeColumn>(patientAgeColumn ?? 1);
  const [selectedCell, setSelectedCell] = useState<TpedSelectedCell>({
    ageColumn: patientAgeColumn ?? 1,
    lineCode: 'A',
  });

  useEffect(() => {
    if (patientAgeColumn) {
      setFocusedAgeColumn(patientAgeColumn);
      setSelectedCell({ ageColumn: patientAgeColumn, lineCode: 'A' });
    }
  }, [patientAgeColumn]);

  const selectedMilestone = getEffectiveTpedMilestone(selectedCell.lineCode, selectedCell.ageColumn);

  const handleAgeColumnChange = (value: string) => {
    const ageColumn = Number(value) as TpedAgeColumn;
    const lineCode = getEffectiveTpedMilestone(selectedCell.lineCode, ageColumn) ? selectedCell.lineCode : 'A';
    setFocusedAgeColumn(ageColumn);
    setSelectedCell({ ageColumn, lineCode });
  };

  const patientAgeText =
    chronologicalMonth === null
      ? t('notAvailable', 'No disponible')
      : `${chronologicalMonth} ${chronologicalMonth === 1 ? t('month', 'mes') : t('months', 'meses')}`;

  return (
    <section aria-labelledby="tped-reference-title" className={styles.widget}>
      <header className={styles.widgetHeader}>
        <div>
          <div className={styles.titleRow}>
            <h3 id="tped-reference-title">{t('tpedReferenceTitle', TPED_DEFINITION.title)}</h3>
            <Tag size="sm" type="warm-gray">
              {t('tpedLegacyLabel', 'Histórico')}
            </Tag>
            <Tag size="sm" type="outline">
              {t('tpedReferenceOnly', 'Solo referencia')}
            </Tag>
          </div>
          <p>{TPED_DEFINITION.id}</p>
        </div>

        <div className={styles.ageSummary}>
          <span>{t('tpedPatientAge', 'Edad cronológica')}</span>
          <strong>{patientAgeText}</strong>
        </div>
      </header>

      <div className={styles.normativeNotice}>
        <WarningAltFilled aria-hidden="true" size={18} />
        <span>{t('tpedLegacyNotice', 'La NTS 238 vigente utiliza Huanca Test y EDI.')}</span>
      </div>

      <div className={styles.toolbar}>
        <Select
          id="tped-focused-age"
          labelText={t('tpedFocusedAge', 'Columna enfocada')}
          onChange={(event) => handleAgeColumnChange(event.target.value)}
          size="sm"
          value={focusedAgeColumn}
        >
          {TPED_AGE_COLUMNS.map((ageColumn) => (
            <SelectItem
              key={ageColumn}
              text={`${ageColumn} ${ageColumn === 1 ? t('month', 'mes') : t('months', 'meses')}`}
              value={ageColumn}
            />
          ))}
        </Select>

        {chronologicalMonth !== null && patientAgeColumn === null && (
          <p className={styles.ageWarning} role="status">
            {chronologicalMonth < 1
              ? t('tpedNoPrintedAgeColumn', 'Aún no corresponde una columna impresa del TPED.')
              : t('tpedOutsideAgeRange', 'El paciente está fuera del rango de 0 a 30 meses.')}
          </p>
        )}
      </div>

      <TpedMatrix focusedAgeColumn={focusedAgeColumn} onSelectCell={setSelectedCell} selectedCell={selectedCell} />
      <TpedMilestoneDetail milestone={selectedMilestone} selectedAgeColumn={selectedCell.ageColumn} />
    </section>
  );
};

export default TpedReferenceWidget;
