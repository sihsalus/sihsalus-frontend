import { Button, InlineLoading, Tile } from '@carbon/react';
import React, { useState } from 'react';

import { useSQLPreview } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

interface SQLPreviewSectionProps {
  indicadorId: string;
  versionId?: string;
  versionNum?: number;
}

const SQLPreviewSection: React.FC<SQLPreviewSectionProps> = ({ indicadorId, versionId, versionNum }) => {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useSQLPreview(indicadorId, versionId);

  return (
    <Tile className={styles.sqlTile}>
      <div className={styles.sqlHeader}>
        <div>
          <strong>SQL generado</strong>
          {versionNum ? <span className={styles.mutedText}> versión #{versionNum}</span> : null}
        </div>
        <Button kind="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Ocultar' : 'Ver'}
        </Button>
      </div>

      {expanded ? (
        isLoading ? (
          <InlineLoading description="Generando SQL..." />
        ) : error ? (
          <div className={styles.errorBanner}>{error.message}</div>
        ) : data ? (
          <div className={styles.sqlBody}>
            <div className={styles.mutedText}>Período: {data.periodo_inicio} - {data.periodo_fin}</div>
            <pre className={styles.codeBlock}>{data.sql}</pre>
            <pre className={styles.codeBlock}>{JSON.stringify(data.params, null, 2)}</pre>
          </div>
        ) : null
      ) : null}
    </Tile>
  );
};

export default SQLPreviewSection;
