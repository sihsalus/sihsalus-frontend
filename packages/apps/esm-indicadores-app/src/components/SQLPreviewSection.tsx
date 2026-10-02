import { Button, InlineLoading } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { useSQLPreview } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

interface SQLPreviewSectionProps {
  indicadorId: string;
  versionId?: string;
  versionNum?: number;
}

const SQLPreviewSection: React.FC<SQLPreviewSectionProps> = ({ indicadorId, versionId, versionNum }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useSQLPreview(indicadorId, versionId);

  return (
    <div className={styles.sqlBlock}>
      <div className={styles.sqlHeader}>
        <div>
          <strong>{t('generatedSql', 'SQL generado')}</strong>
          {versionNum ? (
            <span className={styles.mutedText}> {t('sqlVersion', 'versión #{{num}}', { num: versionNum })}</span>
          ) : null}
        </div>
        <Button kind="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t('hide', 'Ocultar') : t('view', 'Ver')}
        </Button>
      </div>

      {expanded ? (
        isLoading ? (
          <InlineLoading description={t('generatingSql', 'Generando SQL...')} />
        ) : error ? (
          <div className={styles.errorBanner}>
            {getUserFacingErrorMessage(
              error,
              t('sqlPreviewFailed', 'No se pudo generar la vista previa SQL.'),
              indicatorsErrorMessageOptions(t),
            )}
          </div>
        ) : data ? (
          <div className={styles.sqlBody}>
            <div className={styles.mutedText}>
              {t('sqlPeriod', 'Período: {{inicio}} - {{fin}}', { inicio: data.periodo_inicio, fin: data.periodo_fin })}
            </div>
            <pre className={styles.codeBlock}>{data.sql}</pre>
            <pre className={styles.codeBlock}>{JSON.stringify(data.params, null, 2)}</pre>
          </div>
        ) : null
      ) : null}
    </div>
  );
};

export default SQLPreviewSection;
