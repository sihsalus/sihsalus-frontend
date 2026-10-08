import { formatDate } from '@openmrs/esm-framework';
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientPrenatalAntecedents } from '../../types';
import { obstetricHistoryFields } from '../../maternal-and-child-health/obstetric-history-fields';
import styles from './obstetric-history-chart.scss';

interface Props {
  record: PatientPrenatalAntecedents;
}

const nodes = [
  { key: 'gravidez', x: 20, y: 20 },
  { key: 'partoAborto', x: 225, y: 20 },
  { key: 'partos', x: 225, y: 214 },
  { key: 'partosVaginales', x: 445, y: 80 },
  { key: 'cesareas', x: 445, y: 270 },
  { key: 'partoNacidoVivo', x: 665, y: 80 },
  { key: 'partoNacidoMuerto', x: 665, y: 270 },
  { key: 'nacidosVivosViven', x: 885, y: 20 },
  { key: 'muertePrimeraSemana', x: 885, y: 145 },
  { key: 'muerteDespuesPrimeraSemana', x: 885, y: 270 },
] as const;

const referenceFlags = [
  'obstetricZeroOrMoreThanThree',
  'obstetricLowBirthWeight',
  'obstetricMultipleBirth',
  'obstetricPretermBirth',
] as const;

/** Read-only HCMP layout, showing the values of one recorded history. */
const ObstetricHistoryChart: React.FC<Props> = ({ record }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const titleId = useId();
  const descriptionId = useId();
  const valueText = (value?: number) => (value === undefined ? t('obstetricNotRecorded') : String(value));

  return (
    <figure className={styles.figure}>
      <figcaption>
        <h5 id={titleId}>{t('obstetricDiagramTitle')}</h5>
        <p id={descriptionId}>{t('obstetricDiagramHelp')}</p>
        <p>{t('obstetricRecordedOn', { date: formatDate(new Date(record.date)) })}</p>
      </figcaption>
      <div className={styles.scrollArea} role="region" aria-label={t('obstetricDiagramTitle')}>
        <svg
          className={styles.diagram}
          viewBox="0 0 1080 465"
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <g className={styles.connections}>
            <path d="M195 62H225 M108 104L225 254 M400 254L445 122 M400 254L445 312 M620 122L642 217L665 122 M620 312L642 217L665 312 M840 122L885 62 M840 122L885 187 M840 122L885 312" />
          </g>
          {nodes.map(({ key, x, y }) => {
            const field = obstetricHistoryFields.find((field) => field.key === key);
            return (
              <g
                key={key}
                transform={`translate(${x},${y})`}
                aria-label={`${t(field.labelKey)}: ${valueText(record[key])}`}
              >
                <rect width="175" height="84" rx="4" className={styles.node} />
                <text x="87.5" y="28" textAnchor="middle" className={styles.value}>
                  {valueText(record[key])}
                </text>
                <text x="87.5" y="58" textAnchor="middle" className={styles.label}>
                  {t(field.labelKey)}
                </text>
              </g>
            );
          })}
          <g transform="translate(20,140)">
            {referenceFlags.map((key, index) => (
              <g
                key={key}
                transform={`translate(0,${index * 35})`}
                aria-label={`${t(key)}: ${t('obstetricNotRecorded')}`}
              >
                <rect x="0" y="0" width="16" height="16" className={styles.flag} />
                <path d="M4 8H12" className={styles.connections} />
                <text x="25" y="13" className={styles.label}>
                  {t(key)}
                </text>
              </g>
            ))}
          </g>
          <g
            transform="translate(225,385)"
            aria-label={`${t('obstetricHighestBirthWeight')}: ${valueText(record.mayorPesoRn)}`}
          >
            <rect width="615" height="55" rx="4" className={styles.node} />
            <text x="18" y="34" className={styles.label}>
              {t('obstetricHighestBirthWeight')}
            </text>
            <text x="595" y="34" textAnchor="end" className={styles.weightValue}>
              {record.mayorPesoRn === undefined ? t('obstetricNotRecorded') : `${record.mayorPesoRn} g`}
            </text>
          </g>
        </svg>
      </div>
      <dl className={styles.compactDiagram}>
        {obstetricHistoryFields.map(({ key, labelKey }) => (
          <div className={styles.compactNode} key={key}>
            <dt>{t(labelKey)}</dt>
            <dd>{key === 'mayorPesoRn' && record[key] !== undefined ? `${record[key]} g` : valueText(record[key])}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.legend}>{t('obstetricReferenceFlagsHelp')}</p>
    </figure>
  );
};

export default ObstetricHistoryChart;
