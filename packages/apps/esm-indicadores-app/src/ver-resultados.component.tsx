import {
  Button,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { formatDate, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { calcularAhora, type ResultadosFilters, useIndicadores, useResultados } from './hooks/useIndicadoresMock';
import styles from './indicators-dashboard.module.scss';

const ALL = '__all__';
const toIsoDay = (date?: Date) => (date ? date.toISOString().slice(0, 10) : undefined);

const VerResultados: React.FC = () => {
  const { t } = useTranslation();
  const { indicadores } = useIndicadores();
  const [filters, setFilters] = useState<ResultadosFilters>({});
  const { resultados } = useResultados(filters);

  const handleCalcular = () => {
    const { calculados } = calcularAhora();
    showSnackbar({
      title: t('calculationDone', 'Cálculo completado'),
      subtitle: t('indicatorsCalculated', '{{count}} indicadores calculados', { count: calculados }),
      kind: 'success',
      isLowContrast: true,
    });
  };

  const headers = [
    { key: 'indicadorNombre', header: t('indicator', 'Indicador') },
    { key: 'periodo', header: t('period', 'Periodo') },
    { key: 'valor', header: t('value', 'Valor') },
    { key: 'calculadoEn', header: t('calculatedAt', 'Calculado') },
  ];

  const indicadorOptions = [ALL, ...indicadores.map((i) => i.id)];
  const indicadorLabel = (id: string) =>
    id === ALL ? t('allIndicators', 'Todos los indicadores') : (indicadores.find((i) => i.id === id)?.nombre ?? id);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t('viewResults', 'Ver resultados')}</h2>
        <div className={styles.headerActions}>
          <Button renderIcon={Renew} onClick={handleCalcular}>
            {t('calculateNow', 'Calcular ahora')}
          </Button>
        </div>
      </div>

      <div className={styles.filters}>
        <Dropdown
          id="filtro-indicador"
          titleText={t('indicator', 'Indicador')}
          label={indicadorLabel(filters.indicadorId ?? ALL)}
          items={indicadorOptions}
          selectedItem={filters.indicadorId ?? ALL}
          itemToString={(item) => (item ? indicadorLabel(item) : '')}
          onChange={({ selectedItem }) =>
            setFilters((f) => ({ ...f, indicadorId: selectedItem && selectedItem !== ALL ? selectedItem : undefined }))
          }
        />
        <DatePicker
          datePickerType="range"
          onChange={(dates: Array<Date>) =>
            setFilters((f) => ({ ...f, periodoInicio: toIsoDay(dates[0]), periodoFin: toIsoDay(dates[1]) }))
          }
        >
          <DatePickerInput id="filtro-inicio" labelText={t('from', 'Desde')} placeholder="aaaa-mm-dd" size="md" />
          <DatePickerInput id="filtro-fin" labelText={t('to', 'Hasta')} placeholder="aaaa-mm-dd" size="md" />
        </DatePicker>
      </div>

      {resultados.length === 0 ? (
        <Tile className={styles.empty}>
          <p>{t('noResults', 'No hay resultados para los filtros seleccionados.')}</p>
        </Tile>
      ) : (
        <TableContainer>
          <Table aria-label={t('results', 'Resultados')}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key}>{header.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {resultados.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.indicadorNombre}</TableCell>
                  <TableCell>{`${r.periodoInicio} → ${r.periodoFin}`}</TableCell>
                  <TableCell>
                    <Tag type="blue">{r.valor}</Tag>
                  </TableCell>
                  <TableCell>{formatDate(new Date(r.calculadoEn))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
};

export default VerResultados;
