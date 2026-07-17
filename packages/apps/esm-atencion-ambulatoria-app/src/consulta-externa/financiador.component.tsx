import {
  Button,
  DataTable,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  type TagProps,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import {
  LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  launchPatientWorkspace,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { type InsuranceEntry, useInsuranceProvider } from '../hooks/useInsuranceProvider';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface FinanciadorProps {
  patientUuid: string;
}

type TagType = NonNullable<TagProps<'div'>['type']>;

/**
 * Mapeo por UUID de concepto (visit attribute «Financiador» del catálogo
 * canónico «Tipo de seguro»). Los conceptos vienen del content package.
 */
const insuranceTagTypeByConceptUuid: Record<string, TagType> = {
  [SIS_CONCEPT_UUID]: 'green',
  ...Object.fromEntries(LEGACY_SIS_PRODUCT_CONCEPT_UUIDS.map((uuid) => [uuid, 'green' as TagType])),
  'af799b5e-313c-4352-80c4-5007dcd42f29': 'blue', // EsSalud
  'ec420364-fde1-452d-9c48-fafb4ea73a58': 'purple', // Seguro Privado
  'c69b424f-4d9c-4ba9-aeae-045ff5a5e530': 'warm-gray', // Particular / sin seguro
};

/** Fallback por display para las obs legacy, que no traen UUID de concepto. */
const insuranceTagTypeByDisplay: Record<string, TagType> = {
  SIS: 'green',
  EsSalud: 'blue',
  Privado: 'purple',
  Particular: 'warm-gray',
};

function getInsuranceTagType(entry: InsuranceEntry): TagType {
  if (entry.conceptUuid && insuranceTagTypeByConceptUuid[entry.conceptUuid]) {
    return insuranceTagTypeByConceptUuid[entry.conceptUuid];
  }
  return insuranceTagTypeByDisplay[entry.display] ?? 'gray';
}

const Financiador: React.FC<FinanciadorProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { insuranceEntries, isLoading } = useInsuranceProvider(patientUuid, config.concepts?.insuranceProviderUuid);

  const headers = [
    { key: 'date', header: t('dateAndTime', 'Fecha y hora') },
    { key: 'provider', header: t('insuranceProvider', 'Financiador') },
    { key: 'encounter', header: t('encounterType', 'Tipo de Encuentro') },
  ];

  const rows = insuranceEntries.map((entry) => ({
    id: entry.uuid,
    date: entry.obsDatetime ? formatDate(new Date(entry.obsDatetime), { time: true }) : '—',
    provider: (
      <Tag type={getInsuranceTagType(entry)} size="sm">
        {entry.display}
      </Tag>
    ),
    encounter:
      entry.source === 'visit-attribute' ? t('activeVisitFinanciador', 'Visita activa') : entry.encounterType || '—',
  }));

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.consultaExternaForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>{t('insuranceHistory', 'Historial de Financiador')}</span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addInsurance', 'Registrar Financiador')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('noInsuranceData', 'No hay datos de financiador registrados para este paciente.')}</p>
        </div>
      ) : (
        <DataTable rows={rows} headers={headers} size="sm">
          {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()} aria-label={t('insuranceHistory', 'Historial de Financiador')}>
                <TableHead>
                  <TableRow>
                    {tableHeaders.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}
    </div>
  );
};

export default Financiador;
