import { Tag, Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useObstetricRisk } from '../../../../hooks/use-obstetric-risk';

import styles from './risk-classification.scss';

interface RiskClassificationProps {
  patientUuid: string;
}

const RISK_TAG_TYPE: Record<string, 'green' | 'red' | 'magenta' | 'gray'> = {
  bajo: 'green',
  alto: 'red',
  'muy-alto': 'magenta',
  indeterminado: 'gray',
};

const RISK_LABELS: Record<string, string> = {
  bajo: 'Bajo Riesgo',
  alto: 'Alto Riesgo',
  'muy-alto': 'Muy Alto Riesgo',
  indeterminado: 'Sin Evaluar',
};

/**
 * Widget de clasificación de riesgo obstétrico según NTS 105-MINSA.
 */
const RiskClassification: React.FC<RiskClassificationProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { riskLevel, riskFactors, lastEvaluationDate, isLoading, error } = useObstetricRisk(patientUuid);

  if (isLoading) return <Tile className={styles.card}>{t('loading', 'Loading...')}</Tile>;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('obstetricRisk', 'Riesgo Obstétrico')}</h5>
        <Tag type={RISK_TAG_TYPE[riskLevel]} size="sm">
          {t(`risk_${riskLevel}`, RISK_LABELS[riskLevel])}
        </Tag>
      </div>
      <div className={styles.content}>
        {riskFactors.length > 0 ? (
          <div className={styles.factors}>
            <span className={styles.label}>{t('riskFactors', 'Factores de riesgo')}:</span>
            <ul className={styles.factorList}>
              {riskFactors.map((factor, idx) => (
                <li key={idx}>{factor}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.noData}>{t('noRiskFactors', 'No se han evaluado factores de riesgo')}</p>
        )}
        {lastEvaluationDate && (
          <div className={styles.row}>
            <span className={styles.label}>{t('lastEvaluation', 'Última evaluación')}:</span>
            <span className={styles.value}>{lastEvaluationDate}</span>
          </div>
        )}
      </div>
      {error && <p className={styles.error}>{t('errorLoading', 'Error al cargar datos')}</p>}
    </Tile>
  );
};

export default RiskClassification;
