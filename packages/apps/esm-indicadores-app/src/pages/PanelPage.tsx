import { InlineLoading, Select, SelectItem, Tile } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import IndicadorResumenCard from '../components/IndicadorResumenCard';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { useAllIndicadores } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

const MIN_YEAR = 2000;

const currentYear = () => new Date().getFullYear();

const PanelPage: React.FC = () => {
  const { t } = useTranslation();
  const [anio, setAnio] = useState(currentYear());
  const { data, isLoading, error } = useAllIndicadores();

  const years = useMemo(() => {
    const list: Array<number> = [];
    for (let year = currentYear(); year >= MIN_YEAR; year -= 1) {
      list.push(year);
    }
    return list;
  }, []);

  const activos = useMemo(() => (data ?? []).filter((indicador) => indicador.activo), [data]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>{t('panel', 'Panel')}</h2>
          <p className={styles.subtitle}>
            {t('panelSubtitle', 'Cumplimiento anual de los indicadores activos en un solo vistazo.')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Select
            id="panel-anio"
            className={styles.panelYearSelect}
            labelText={t('year', 'Año')}
            value={anio}
            onChange={(event) => setAnio(Number(event.target.value))}
            size="sm"
          >
            {years.map((year) => (
              <SelectItem key={year} value={year} text={String(year)} />
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? <InlineLoading description={t('loadingIndicators', 'Cargando indicadores...')} /> : null}
      {error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            error,
            t('indicatorsLoadFailed', 'No se pudieron cargar los indicadores.'),
            indicatorsErrorMessageOptions(t),
          )}
        </div>
      ) : null}

      {!isLoading && !error ? (
        activos.length ? (
          <div className={styles.summaryGrid}>
            {activos.map((indicador) => (
              <IndicadorResumenCard key={indicador.id} indicador={indicador} anio={anio} />
            ))}
          </div>
        ) : (
          <Tile className={styles.empty}>{t('panelNoIndicators', 'No hay indicadores activos para mostrar.')}</Tile>
        )
      ) : null}
    </div>
  );
};

export default PanelPage;
