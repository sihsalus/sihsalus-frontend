import { formatDatetime, parseDate, useConfig } from '@openmrs/esm-framework';
import { ClinicalDataOverview } from '@sihsalus/esm-sihsalus-shared'; // Ajusta la ruta según tu estructura
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { credNeonatalEditPrivilege } from '../../../../constants';
import { useHasPrivilege } from '../../../../rbac';
import { useVitalsAndBiometrics, useVitalsConceptMetadata, withUnit } from '../../../common';

interface BiometricsBaseProps {
  patientUuid: string;
  pageSize?: number;
}

const NewbornBiometricsBase: React.FC<BiometricsBaseProps> = ({ patientUuid, pageSize = 10 }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credNeonatalEditPrivilege);
  const config = useConfig();
  const { data: conceptUnits } = useVitalsConceptMetadata();
  const { data: biometrics, error, isLoading, isValidating } = useVitalsAndBiometrics(patientUuid, 'biometrics');

  const clinicalFields = useMemo(
    () => [
      {
        key: 'date',
        label: t('date&Time', 'Date & time'),
        isSortable: true,
        sortFunc: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        format: (date) => formatDatetime(parseDate(date), { mode: 'wide' }),
        showInChart: false,
      },
      {
        key: 'weight',
        conceptUuid: 'weightUuid',
        label: 'weight',
        isSortable: true,
        sortFunc: (a, b) => (a.weight && b.weight ? a.weight - b.weight : 0),
        showInChart: true,
      },
      {
        key: 'height',
        conceptUuid: 'heightUuid',
        label: 'height',
        isSortable: true,
        sortFunc: (a, b) => (a.height && b.height ? a.height - b.height : 0),
        showInChart: true,
      },
      {
        key: 'headCircumference',
        conceptUuid: 'headCircumferenceUuid',
        label: 'headCircumference',
        isSortable: true,
        sortFunc: (a, b) =>
          a.headCircumference && b.headCircumference ? a.headCircumference - b.headCircumference : 0,
        showInChart: true,
      },
      {
        key: 'chestCircumference',
        conceptUuid: 'chestCircumferenceUuid',
        label: 'chestCircumference',
        isSortable: true,
        sortFunc: (a, b) =>
          a.chestCircumference && b.chestCircumference ? a.chestCircumference - b.chestCircumference : 0,
        showInChart: true,
      },
    ],
    [t],
  );

  const { tableHeaders, tableRows, chartConfig } = useMemo(() => {
    // Generar tableHeaders
    const headers = clinicalFields.map((field) => ({
      key: field.key,
      header: field.conceptUuid
        ? withUnit(t(field.label), conceptUnits?.get(config.concepts[field.conceptUuid]) ?? '')
        : t(field.label),
      isSortable: field.isSortable,
      sortFunc: field.sortFunc,
    }));

    // Generar tableRows
    const rows =
      biometrics?.map((item, index) => {
        const row: { id: string; [key: string]: string | number | React.ReactNode } = { id: `${index}` };
        clinicalFields.forEach((field) => {
          row[field.key] = field.format ? field.format(item[field.key]) : (item[field.key] ?? '--');
        });
        return row;
      }) || [];

    // Generar chartConfig
    const vitalSigns = clinicalFields
      .filter((field) => field.showInChart && field.conceptUuid)
      .map((field) => ({
        id: field.key,
        title: withUnit(t(field.label), conceptUnits?.get(config.concepts[field.conceptUuid]) ?? ''),
        value: field.key,
      }));

    return {
      tableHeaders: headers,
      tableRows: rows,
      chartConfig: {
        vitalSigns,
        mappings: {}, // No hay campos relacionados en este caso
      },
    };
  }, [clinicalFields, biometrics, conceptUnits, config.concepts, t]);

  const clinicalData = (biometrics ?? []) as unknown as Array<{ date: string; [key: string]: string | number | null }>;

  return (
    <ClinicalDataOverview
      patientUuid={patientUuid}
      pageSize={pageSize}
      headerTitle={t('newbornAntropometrics', 'Antropometría')}
      data={clinicalData}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      tableHeaders={tableHeaders}
      tableRows={tableRows}
      formWorkspace={canEdit ? 'newborn-anthropometric-form' : undefined}
      emptyStateDisplayText={t('biometrics_lower', 'biometrics')}
      conceptUnits={conceptUnits || new Map()} // Aseguramos que conceptUnits no sea undefined
      config={config}
      chartConfig={chartConfig}
    />
  );
};

export default NewbornBiometricsBase;
