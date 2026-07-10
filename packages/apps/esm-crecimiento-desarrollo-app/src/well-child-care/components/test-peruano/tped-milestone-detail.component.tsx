import { Tag } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TPED_LINES, type TpedAgeColumn, type TpedMilestoneDefinition } from '../../test-peruano';
import styles from './tped-reference-widget.scss';

interface TpedMilestoneDetailProps {
  selectedAgeColumn: TpedAgeColumn;
  milestone: TpedMilestoneDefinition | null;
}

const evidenceTranslation = {
  observed: ['tpedEvidenceObserved', 'Observado'],
  reported: ['tpedEvidenceReported', 'Referido'],
  observedOrReported: ['tpedEvidenceBoth', 'Observado o referido'],
} as const;

const TpedMilestoneDetail: React.FC<TpedMilestoneDetailProps> = ({ milestone, selectedAgeColumn }) => {
  const { t } = useTranslation();

  if (!milestone) {
    return (
      <section aria-live="polite" className={styles.detailPanel}>
        <p>{t('tpedNoMilestoneForCell', 'Esta línea todavía no presenta un hito en la edad seleccionada.')}</p>
      </section>
    );
  }

  const line = TPED_LINES.find((candidate) => candidate.code === milestone.lineCode);
  const [evidenceKey, evidenceDefault] = evidenceTranslation[milestone.evidence];
  const isInherited = milestone.ageMonths !== selectedAgeColumn;

  return (
    <section aria-live="polite" className={styles.detailPanel}>
      <div className={styles.detailTags}>
        <Tag size="sm" type="blue">
          {milestone.code}
        </Tag>
        <Tag size="sm" type="cool-gray">
          {t(evidenceKey, evidenceDefault)}
        </Tag>
        <Tag size="sm" type={milestone.conceptUuid ? 'green' : 'warm-gray'}>
          {milestone.conceptUuid
            ? t('tpedConceptMapped', 'Concepto mapeado')
            : t('tpedConceptPending', 'Concepto pendiente')}
        </Tag>
      </div>

      <h4>{milestone.title}</h4>

      {isInherited && (
        <p className={styles.inheritanceNotice}>
          {t(
            'tpedInheritanceNotice',
            'La columna de {{selectedAge}} meses conserva el hito de {{milestoneAge}} meses.',
            { milestoneAge: milestone.ageMonths, selectedAge: selectedAgeColumn },
          )}
        </p>
      )}

      <dl className={styles.detailList}>
        <div>
          <dt>{t('tpedDevelopmentLine', 'Línea del desarrollo')}</dt>
          <dd>{line ? t(`tpedLine${line.code}`, line.title) : milestone.lineCode}</dd>
        </div>
        <div>
          <dt>{t('tpedMilestoneAge', 'Edad del hito')}</dt>
          <dd>
            {milestone.ageMonths} {milestone.ageMonths === 1 ? t('month', 'mes') : t('months', 'meses')}
          </dd>
        </div>
        <div>
          <dt>{t('tpedEvidence', 'Evidencia')}</dt>
          <dd>{t(evidenceKey, evidenceDefault)}</dd>
        </div>
        <div>
          <dt>{t('tpedSource', 'Fuente')}</dt>
          <dd>
            {t('tpedSourceValue', 'NTS 087, Anexo 9, página PDF {{page}}', {
              page: milestone.sourcePdfPage,
            })}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default TpedMilestoneDetail;
