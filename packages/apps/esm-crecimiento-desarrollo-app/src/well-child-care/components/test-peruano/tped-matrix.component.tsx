import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  getEffectiveTpedMilestone,
  TPED_AGE_COLUMNS,
  TPED_LINES,
  type TpedAgeColumn,
  type TpedLineCode,
} from '../../test-peruano';
import styles from './tped-reference-widget.scss';

export interface TpedSelectedCell {
  ageColumn: TpedAgeColumn;
  lineCode: TpedLineCode;
}

interface TpedMatrixProps {
  focusedAgeColumn: TpedAgeColumn;
  onSelectCell: (cell: TpedSelectedCell) => void;
  selectedCell: TpedSelectedCell;
}

const TpedMatrix: React.FC<TpedMatrixProps> = ({ focusedAgeColumn, onSelectCell, selectedCell }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.matrixScroller} data-testid="tped-matrix-scroller">
      <table className={styles.matrix} aria-label={t('tpedMatrixAria', 'Matriz de hitos del Test Peruano')}>
        <caption className={styles.visuallyHidden}>
          {t('tpedMatrixCaption', 'Doce líneas del desarrollo organizadas por edad en meses')}
        </caption>
        <thead>
          <tr>
            <th className={styles.cornerHeader} scope="col">
              {t('tpedDevelopmentLine', 'Línea del desarrollo')}
            </th>
            {TPED_AGE_COLUMNS.map((ageColumn) => (
              <th
                aria-current={ageColumn === focusedAgeColumn ? 'true' : undefined}
                className={`${styles.ageHeader} ${ageColumn === focusedAgeColumn ? styles.focusedColumn : ''}`}
                key={ageColumn}
                scope="col"
              >
                <strong>{ageColumn}</strong>
                <span>{ageColumn === 1 ? t('month', 'mes') : t('months', 'meses')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TPED_LINES.map((line) => (
            <tr key={line.code}>
              <th className={styles.lineHeader} scope="row">
                <span className={styles.lineCode}>{line.code}</span>
                <span>{t(`tpedLine${line.code}`, line.title)}</span>
              </th>
              {TPED_AGE_COLUMNS.map((ageColumn) => {
                const directMilestone = line.milestones.find((milestone) => milestone.ageMonths === ageColumn);
                const effectiveMilestone = getEffectiveTpedMilestone(line.code, ageColumn);
                const isFocusedColumn = ageColumn === focusedAgeColumn;
                const isSelected = selectedCell.lineCode === line.code && selectedCell.ageColumn === ageColumn;

                if (!effectiveMilestone) {
                  return (
                    <td
                      className={`${styles.matrixCell} ${styles.emptyCell} ${
                        isFocusedColumn ? styles.focusedColumn : ''
                      }`}
                      key={`${line.code}-${ageColumn}`}
                    >
                      <span aria-hidden="true">-</span>
                      <span className={styles.visuallyHidden}>{t('tpedNoMilestone', 'Sin hito anterior')}</span>
                    </td>
                  );
                }

                const isInherited = !directMilestone;
                const ageLabel = ageColumn === 1 ? t('month', 'mes') : t('months', 'meses');
                const accessibleLabel = isInherited
                  ? t('tpedInheritedMilestoneLabel', '{{code}}. {{title}}. Continúa en {{age}} {{ageLabel}}', {
                      age: ageColumn,
                      ageLabel,
                      code: effectiveMilestone.code,
                      title: effectiveMilestone.title,
                    })
                  : t('tpedDirectMilestoneLabel', '{{code}}. {{title}}. Hito de {{age}} {{ageLabel}}', {
                      age: ageColumn,
                      ageLabel,
                      code: effectiveMilestone.code,
                      title: effectiveMilestone.title,
                    });

                return (
                  <td
                    className={`${styles.matrixCell} ${isFocusedColumn ? styles.focusedColumn : ''}`}
                    key={`${line.code}-${ageColumn}`}
                  >
                    <button
                      aria-label={accessibleLabel}
                      aria-pressed={isSelected}
                      className={`${styles.milestoneButton} ${isInherited ? styles.inheritedMilestone : ''} ${
                        isSelected ? styles.selectedMilestone : ''
                      }`}
                      onClick={() => onSelectCell({ ageColumn, lineCode: line.code })}
                      title={accessibleLabel}
                      type="button"
                    >
                      <strong>{effectiveMilestone.code}</strong>
                      {isInherited && <span>{t('tpedContinues', 'continúa')}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TpedMatrix;
