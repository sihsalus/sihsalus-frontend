import { Button, InlineLoading, InlineNotification, Layer, Select, SelectItem, TextInput } from '@carbon/react';
import { Download, Launch } from '@carbon/react/icons';
import {
  ConfigurableLink,
  PageHeader,
  PageHeaderContent,
  RegistrationPictogram,
  useConfig,
} from '@openmrs/esm-framework';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import { useAdmissions } from '../resources/admissions.resource';
import styles from './admission-home.scss';

interface AdmissionConfig {
  admissionReportPageSize?: number;
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(new Date(value));
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AdmissionHome() {
  const { t } = useTranslation(moduleName);
  const config = useConfig() as AdmissionConfig;
  const { admissions, error, isLoading } = useAdmissions(config.admissionReportPageSize ?? 50);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const availableStatuses = useMemo(
    () => Array.from(new Set(admissions.map((admission) => admission.status).filter(Boolean))).sort(),
    [admissions],
  );

  const filteredAdmissions = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

    return admissions.filter((admission) => {
      const matchesSearch =
        !normalizedSearchTerm ||
        [
          admission.patientName,
          admission.medicalRecordNumber,
          admission.service,
          admission.location,
          admission.status,
          formatDate(admission.startDatetime),
          formatTime(admission.startDatetime),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedSearchTerm);

      const matchesStatus = statusFilter === 'all' || admission.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [admissions, searchTerm, statusFilter]);

  const reportSummary = useMemo(
    () => ({
      total: filteredAdmissions.length,
      active: filteredAdmissions.filter((admission) => admission.status === 'Activa').length,
      finished: filteredAdmissions.filter((admission) => admission.status === 'Finalizada').length,
      services: new Set(filteredAdmissions.map((admission) => admission.service).filter(Boolean)).size,
    }),
    [filteredAdmissions],
  );

  const exportFilteredAdmissions = () => {
    const headers = [
      t('date', 'Fecha'),
      t('time', 'Hora'),
      t('patient', 'Paciente'),
      t('medicalRecord', 'HC'),
      t('upsService', 'UPS/servicio'),
      t('location', 'Ubicación'),
      t('status', 'Estado'),
    ];
    const rows = filteredAdmissions.map((admission) => [
      formatDate(admission.startDatetime),
      formatTime(admission.startDatetime),
      admission.patientName,
      admission.medicalRecordNumber,
      admission.service,
      admission.location,
      admission.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admisiones-ups.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const spaBasePath = globalThis.getOpenmrsSpaBase().slice(0, -1);

  return (
    <main className={styles.page}>
      <PageHeader className={styles.header}>
        <PageHeaderContent
          title={t('admissionReportByUps', 'Reporte de admisiones por UPS')}
          illustration={<RegistrationPictogram />}
        />
        <ConfigurableLink to={`${spaBasePath}/admission/merge`} className={styles.headerAction}>
          <Button kind="secondary" renderIcon={Launch} as="span">
            {t('mergeDuplicatePatients', 'Fusionar historias duplicadas')}
          </Button>
        </ConfigurableLink>
      </PageHeader>

      <div className={styles.content}>
        <section
          className={styles.summary}
          aria-label={t('admissionReportMetrics', 'Métricas del reporte de admisiones')}
        >
          <div>
            <span>{t('reportedAdmissions', 'Admisiones reportadas')}</span>
            <strong>{reportSummary.total}</strong>
          </div>
          <div>
            <span>{t('activeAdmissions', 'Activas')}</span>
            <strong>{reportSummary.active}</strong>
          </div>
          <div>
            <span>{t('finishedAdmissions', 'Finalizadas')}</span>
            <strong>{reportSummary.finished}</strong>
          </div>
          <div>
            <span>{t('reportedUpsServices', 'UPS/servicios')}</span>
            <strong>{reportSummary.services}</strong>
          </div>
        </section>

        <section
          className={styles.controls}
          aria-label={t('admissionReportFilters', 'Filtros del reporte de admisiones')}
        >
          <TextInput
            id="admission-report-search"
            labelText={t('searchAdmissions', 'Buscar por paciente, HC, UPS o ubicación')}
            placeholder={t('searchAdmissionsPlaceholder', 'Paciente, HC, UPS, ubicación...')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Select
            id="admission-status-filter"
            labelText={t('filterByStatus', 'Filtrar por estado')}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <SelectItem value="all" text={t('allStatuses', 'Todos los estados')} />
            {availableStatuses.map((status) => (
              <SelectItem key={status} value={status} text={status} />
            ))}
          </Select>
          <Button
            kind="tertiary"
            renderIcon={Download}
            onClick={exportFilteredAdmissions}
            disabled={filteredAdmissions.length === 0}
          >
            {t('exportCsv', 'Exportar CSV')}
          </Button>
        </section>

        {isLoading ? <InlineLoading description={t('loadingAdmissions', 'Cargando admisiones')} /> : null}
        {error ? (
          <InlineNotification
            kind="error"
            lowContrast
            title={t('admissionReportError', 'No se pudo cargar el reporte de admisiones')}
          />
        ) : null}

        <Layer>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('date', 'Fecha')}</th>
                  <th>{t('time', 'Hora')}</th>
                  <th>{t('patient', 'Paciente')}</th>
                  <th>{t('medicalRecord', 'HC')}</th>
                  <th>{t('upsService', 'UPS/servicio')}</th>
                  <th>{t('location', 'Ubicación')}</th>
                  <th>{t('status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map((admission) => (
                  <tr key={admission.uuid}>
                    <td>{formatDate(admission.startDatetime)}</td>
                    <td>{formatTime(admission.startDatetime)}</td>
                    <td>
                      {admission.patientUuid ? (
                        <ConfigurableLink
                          to={`${spaBasePath}/admission/patient/${admission.patientUuid}`}
                          className={styles.patientLink}
                        >
                          {admission.patientName}
                        </ConfigurableLink>
                      ) : (
                        admission.patientName
                      )}
                    </td>
                    <td>{admission.medicalRecordNumber}</td>
                    <td>{admission.service}</td>
                    <td>{admission.location}</td>
                    <td>{admission.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredAdmissions.length === 0 ? (
              <p className={styles.empty}>{t('noAdmissionsFound', 'No se encontraron admisiones recientes.')}</p>
            ) : null}
          </div>
        </Layer>
      </div>
    </main>
  );
}
