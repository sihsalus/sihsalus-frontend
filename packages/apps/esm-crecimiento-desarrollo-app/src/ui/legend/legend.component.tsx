import { InlineLoading, Tag, type TagProps, Tile } from '@carbon/react';
import { ErrorState, useConfig } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { useSchemasConceptSet } from '../../hooks/useSchemasConceptSet';

import styles from './legend.scss';

interface LegendItem {
  type: TagProps<React.ElementType>['type'];
  display: string;
  label: string;
}

interface LegendTileProps {
  conceptSetUUID: string;
}

const LegendTile: React.FC<LegendTileProps> = ({ conceptSetUUID: _conceptSetUUID }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { schemasConceptSet, isLoading, error } = useSchemasConceptSet(config.legend);

  const legendItems: LegendItem[] = useMemo(() => {
    if (!schemasConceptSet) {
      return [];
    }

    const concept = schemasConceptSet;
    const status = concept.display?.toUpperCase() || 'UNKNOWN';
    return [
      {
        type: (concept.colour || 'gray') as TagProps<React.ElementType>['type'],
        display: status,
        label: t(status, concept.display || 'Unknown'),
      },
    ];
  }, [schemasConceptSet, t]);

  if (error) {
    return (
      <ErrorState
        error={error}
        headerTitle={t('legend', 'Leyenda')}
        aria-label={t('errorState', 'Error al cargar la leyenda')}
      />
    );
  }

  return (
    <Tile className={styles.legendTile} aria-label={t('legend', 'Leyenda')}>
      <h3 className={styles.legendTitle}>{t('legend', 'Leyenda')}</h3>
      {isLoading ? (
        <div className={styles.loadingContainer} role="status" aria-live="polite">
          <InlineLoading description={t('loading', 'Loading...')} />
        </div>
      ) : (
        <div className={styles.legendContainer} role="list" aria-label={t('legendItems', 'Elementos de la leyenda')}>
          {legendItems.length ? (
            legendItems.map((item) => (
              <div key={item.display} className={styles.legendItem} role="listitem">
                <Tag
                  type={item.type}
                  size="sm"
                  aria-label={t(item.display, item.label)}
                  title={t(item.display, item.label)}
                  className={styles.legendTag}
                >
                  {t(item.display, item.label)}
                </Tag>
              </div>
            ))
          ) : (
            <div className={styles.noItems} role="listitem">
              {t('noLegendItems', 'No hay elementos de leyenda disponibles')}
            </div>
          )}
        </div>
      )}
    </Tile>
  );
};

export default LegendTile;
