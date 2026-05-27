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
  const parsedDate = parseDate(value);
  return parsedDate ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(parsedDate) : '';
}

function parseDate(value?: string) {
  if (!value) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsedDate = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function calculateAge(birthDate?: string, referenceDate?: string) {
  const birth = parseDate(birthDate);
  if (!birth) return '';

  const reference = parseDate(referenceDate) ?? new Date();
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age}` : '';
}

function matchesGender(gender: string, expected: 'male' | 'female') {
  const normalizedGender = gender.trim().toLocaleLowerCase();

  return expected === 'male'
    ? ['m', 'male', 'masculino'].includes(normalizedGender)
    : ['f', 'female', 'femenino'].includes(normalizedGender);
}

function getAgeForGender(gender: string, expected: 'male' | 'female', birthDate?: string, referenceDate?: string) {
  return matchesGender(gender, expected) ? calculateAge(birthDate, referenceDate) : '';
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
          admission.documentNumber,
          admission.birthDate,
          admission.hasSis,
          admission.address,
          admission.service,
          admission.location,
          admission.status,
          formatDate(admission.startDatetime),
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
      t('documentNumber', 'DNI'),
      t('birthDateShort', 'F. Nac.'),
      t('hasSis', 'Tiene SIS'),
      t('fullName', 'Nombres y apellidos'),
      t('address', 'Dirección'),
      t('maleAge', 'Edad M'),
      t('femaleAge', 'Edad F'),
      t('service', 'Servicio'),
      t('orderNumber', 'Número de orden'),
    ];
    const rows = filteredAdmissions.map((admission, index) => [
      formatDate(admission.startDatetime),
      admission.documentNumber,
      formatDate(admission.birthDate),
      admission.hasSis,
      admission.patientName,
      admission.address,
      getAgeForGender(admission.gender, 'male', admission.birthDate, admission.startDatetime),
      getAgeForGender(admission.gender, 'female', admission.birthDate, admission.startDatetime),
      admission.service,
      String(index + 1),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atenciones-upss.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const spaBasePath = globalThis.getOpenmrsSpaBase().slice(0, -1);

  return (
    <main className={styles.page}>
      <h1 className={styles.visuallyHidden}>{t('admissionReportByUps', 'Registro de Atenciones')}</h1>
      <PageHeader className={styles.header}>
        <PageHeaderContent
          title={t('admissionReportByUps', 'Registro de Atenciones')}
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
          aria-label={t('admissionReportMetrics', 'Métricas del registro de atenciones')}
        >
          <div>
            <span>{t('reportedAdmissions', 'Atenciones registradas')}</span>
            <strong>{reportSummary.total}</strong>
          </div>
          <div>
            <span>{t('activeAdmissions', 'En curso')}</span>
            <strong>{reportSummary.active}</strong>
          </div>
          <div>
            <span>{t('finishedAdmissions', 'Finalizadas')}</span>
            <strong>{reportSummary.finished}</strong>
          </div>
          <div>
            <span>{t('reportedUpsServices', 'UPSS/servicios')}</span>
            <strong>{reportSummary.services}</strong>
          </div>
        </section>

        <section
          className={styles.controls}
          aria-label={t('admissionReportFilters', 'Filtros del registro de atenciones')}
        >
          <TextInput
            id="admission-report-search"
            labelText={t('searchAdmissions', 'Buscar por paciente, DNI, servicio o dirección')}
            placeholder={t('searchAdmissionsPlaceholder', 'Paciente, DNI, servicio, dirección...')}
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

        {isLoading ? <InlineLoading description={t('loadingAdmissions', 'Cargando atenciones')} /> : null}
        {error ? (
          <InlineNotification
            kind="error"
            lowContrast
            title={t('admissionReportError', 'No se pudo cargar el registro de atenciones')}
          />
        ) : null}

        <Layer>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan={2}>{t('date', 'Fecha')}</th>
                  <th rowSpan={2}>{t('documentNumber', 'DNI')}</th>
                  <th rowSpan={2}>{t('birthDateShort', 'F. Nac.')}</th>
                  <th rowSpan={2}>{t('hasSis', 'Tiene SIS')}</th>
                  <th rowSpan={2}>{t('fullName', 'Nombres y apellidos')}</th>
                  <th rowSpan={2}>{t('address', 'Dirección')}</th>
                  <th colSpan={2}>{t('age', 'Edad')}</th>
                  <th rowSpan={2}>{t('service', 'Servicio')}</th>
                  <th rowSpan={2}>{t('orderNumber', 'Número de orden')}</th>
                </tr>
                <tr>
                  <th>{t('maleInitial', 'M')}</th>
                  <th>{t('femaleInitial', 'F')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map((admission, index) => (
                  <tr key={admission.uuid}>
                    <td>{formatDate(admission.startDatetime)}</td>
                    <td>{admission.documentNumber}</td>
                    <td>{formatDate(admission.birthDate)}</td>
                    <td>{admission.hasSis}</td>
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
                    <td>{admission.address}</td>
                    <td>{getAgeForGender(admission.gender, 'male', admission.birthDate, admission.startDatetime)}</td>
                    <td>{getAgeForGender(admission.gender, 'female', admission.birthDate, admission.startDatetime)}</td>
                    <td>{admission.service}</td>
                    <td>{index + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredAdmissions.length === 0 ? (
              <p className={styles.empty}>{t('noAdmissionsFound', 'No se encontraron atenciones recientes.')}</p>
            ) : null}
          </div>
        </Layer>
      </div>
    </main>
  );
}
