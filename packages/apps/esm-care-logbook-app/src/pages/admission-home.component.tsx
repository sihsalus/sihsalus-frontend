import {
  Button,
  InlineLoading,
  InlineNotification,
  Layer,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
  Tile,
} from '@carbon/react';
import { Download, Launch } from '@carbon/react/icons';
import {
  ConfigurableLink,
  PageHeader,
  PageHeaderContent,
  RegistrationPictogram,
  useConfig,
} from '@openmrs/esm-framework';
import { ageAsDuration } from '@openmrs/esm-utils';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { careLogbookPrivilege, moduleName } from '../constants';
import { useAdmissions } from '../resources/admissions.resource';
import styles from './admission-home.scss';

const EXCEL_CSV_PREAMBLE = '\uFEFFsep=,\r\n';
const twoRowHeaderProps = { rowSpan: 2 };

interface AdmissionConfig {
  admissionReportPageSize?: number;
}

interface AgeLabels {
  month: string;
  months: string;
  week: string;
  weeks: string;
  year: string;
  years: string;
}

type AgeDuration = Partial<Record<'years' | 'months' | 'weeks' | 'days', number>>;

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

function matchesGender(gender: string, expected: 'male' | 'female') {
  const normalizedGender = gender.trim().toLocaleLowerCase();

  return expected === 'male'
    ? ['m', 'male', 'masculino'].includes(normalizedGender)
    : ['f', 'female', 'femenino'].includes(normalizedGender);
}

function getDurationValue(duration: AgeDuration, unit: keyof AgeDuration) {
  const value = duration[unit];

  return typeof value === 'number' && value >= 0 ? value : null;
}

function formatAgeUnit(value: number, singularLabel: string, pluralLabel: string) {
  return `${value} ${value === 1 ? singularLabel : pluralLabel}`;
}

function formatAgeWithUnit(birthDate: string | undefined, referenceDate: string | undefined, labels: AgeLabels) {
  const duration = birthDate ? (ageAsDuration(birthDate, referenceDate ?? new Date()) as AgeDuration | null) : null;

  if (!duration) {
    return '';
  }

  const years = getDurationValue(duration, 'years');
  if (years && years > 0) {
    return formatAgeUnit(years, labels.year, labels.years);
  }

  const months = getDurationValue(duration, 'months');
  if (months && months > 0) {
    return formatAgeUnit(months, labels.month, labels.months);
  }

  const weeks = getDurationValue(duration, 'weeks');
  if (weeks && weeks > 0) {
    return formatAgeUnit(weeks, labels.week, labels.weeks);
  }

  const days = getDurationValue(duration, 'days');
  if (days && days > 0) {
    return formatAgeUnit(Math.ceil(days / 7), labels.week, labels.weeks);
  }

  return formatAgeUnit(0, labels.week, labels.weeks);
}

function getAgeForGender(
  gender: string,
  expected: 'male' | 'female',
  birthDate: string | undefined,
  referenceDate: string | undefined,
  labels: AgeLabels,
) {
  return matchesGender(gender, expected) ? formatAgeWithUnit(birthDate, referenceDate, labels) : '';
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
  const ageLabels = useMemo(
    () => ({
      month: t('ageMonth', 'mes'),
      months: t('ageMonths', 'meses'),
      week: t('ageWeek', 'semana'),
      weeks: t('ageWeeks', 'semanas'),
      year: t('ageYear', 'año'),
      years: t('ageYears', 'años'),
    }),
    [t],
  );

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
          admission.documentType,
          admission.documentNumber,
          admission.identificationStatus,
          admission.communicationCondition,
          admission.responsibleName,
          admission.responsibleRelationship,
          admission.birthDate,
          admission.hasSis,
          admission.address,
          admission.service,
          admission.location,
          admission.status,
          admission.searchText,
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
      t('medicalRecordNumber', 'HCE / código temporal'),
      t('documentType', 'Tipo doc.'),
      t('documentNumber', 'N° documento'),
      t('identificationStatus', 'Estado identificación'),
      t('responsiblePerson', 'Responsable'),
      t('birthDateShort', 'F. Nac.'),
      t('hasSis', 'Tiene SIS'),
      t('fullName', 'Nombres y apellidos'),
      t('address', 'Dirección'),
      t('maleAge', 'Edad M'),
      t('femaleAge', 'Edad F'),
      t('service', 'Servicio'),
      t('orderNumber', 'Número de orden'),
      t('communicationCondition', 'Condición comunicación'),
    ];
    const rows = filteredAdmissions.map((admission, index) => [
      formatDate(admission.startDatetime),
      admission.medicalRecordNumber,
      admission.documentType || t('pending', 'Pendiente'),
      admission.documentNumber || t('pending', 'Pendiente'),
      admission.identificationStatus,
      [admission.responsibleName, admission.responsibleRelationship].filter(Boolean).join(' - '),
      formatDate(admission.birthDate),
      admission.hasSis,
      admission.patientName,
      admission.address,
      getAgeForGender(admission.gender, 'male', admission.birthDate, admission.startDatetime, ageLabels),
      getAgeForGender(admission.gender, 'female', admission.birthDate, admission.startDatetime, ageLabels),
      admission.service,
      String(index + 1),
      admission.communicationCondition,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
    const blob = new Blob([`${EXCEL_CSV_PREAMBLE}${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atenciones-upss.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const spaBasePath = globalThis.getOpenmrsSpaBase().slice(0, -1);

  return (
    <AppErrorBoundary appName="esm-care-logbook-app">
      <RequirePrivilege privilege={careLogbookPrivilege}>
        <main className={styles.page}>
          <h1 className={styles.visuallyHidden}>{t('admissionReportByUps', 'Libro de Atenciones')}</h1>
          <PageHeader className={styles.header}>
            <PageHeaderContent
              className={styles.headerContent}
              title={t('admissionReportByUps', 'Libro de Atenciones')}
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
              aria-label={t('admissionReportMetrics', 'Métricas del libro de atenciones')}
            >
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>
                  {t('reportedAdmissions', 'Atenciones registradas')}
                </header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissions', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>{reportSummary.total}</div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('activeAdmissions', 'En curso')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissions', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>{reportSummary.active}</div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('finishedAdmissions', 'Finalizadas')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissions', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>{reportSummary.finished}</div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('reportedUpsServices', 'UPSS/servicios')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('services', 'Servicios')}</div>
                  <div className={styles.summaryTileValue}>{reportSummary.services}</div>
                </div>
              </Tile>
            </section>

            <section
              className={styles.controls}
              aria-label={t('admissionReportFilters', 'Filtros del libro de atenciones')}
            >
              <TextInput
                id="admission-report-search"
                labelText={t(
                  'searchAdmissions',
                  'Buscar por paciente, documento, HCE, código temporal, seguro, responsable, servicio o ubicación',
                )}
                placeholder={t(
                  'searchAdmissionsPlaceholder',
                  'Paciente, documento, HCE, seguro, responsable, servicio...',
                )}
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
                kind="primary"
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
                title={t('admissionReportError', 'No se pudo cargar el libro de atenciones')}
              />
            ) : null}

            <Layer>
              <TableContainer className={styles.tableWrap}>
                <Table className={styles.table}>
                  <colgroup>
                    <col className={styles.dateColumn} />
                    <col className={styles.identifierColumn} />
                    <col className={styles.documentTypeColumn} />
                    <col className={styles.identifierColumn} />
                    <col className={styles.statusColumn} />
                    <col className={styles.responsibleColumn} />
                    <col className={styles.shortColumn} />
                    <col className={styles.shortColumn} />
                    <col className={styles.personColumn} />
                    <col className={styles.addressColumn} />
                    <col className={styles.ageColumn} />
                    <col className={styles.ageColumn} />
                    <col className={styles.serviceColumn} />
                    <col className={styles.orderColumn} />
                    <col className={styles.communicationColumn} />
                  </colgroup>
                  <TableHead>
                    <TableRow>
                      <TableHeader {...twoRowHeaderProps}>{t('date', 'Fecha')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>
                        {t('medicalRecordNumber', 'HCE / código temporal')}
                      </TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('documentType', 'Tipo doc.')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('documentNumber', 'N° documento')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>
                        {t('identificationStatus', 'Estado identificación')}
                      </TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('responsiblePerson', 'Responsable')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('birthDateShort', 'F. Nac.')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('hasSis', 'Tiene SIS')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('fullName', 'Nombres y apellidos')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('address', 'Dirección')}</TableHeader>
                      <TableHeader colSpan={2}>{t('age', 'Edad')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('service', 'Servicio')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>{t('orderNumber', 'Número de orden')}</TableHeader>
                      <TableHeader {...twoRowHeaderProps}>
                        {t('communicationCondition', 'Condición comunicación')}
                      </TableHeader>
                    </TableRow>
                    <TableRow>
                      <TableHeader>{t('maleInitial', 'M')}</TableHeader>
                      <TableHeader>{t('femaleInitial', 'F')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAdmissions.map((admission, index) => (
                      <TableRow key={admission.uuid}>
                        <TableCell>{formatDate(admission.startDatetime)}</TableCell>
                        <TableCell>{admission.medicalRecordNumber}</TableCell>
                        <TableCell>{admission.documentType || t('pending', 'Pendiente')}</TableCell>
                        <TableCell>{admission.documentNumber || t('pending', 'Pendiente')}</TableCell>
                        <TableCell>{admission.identificationStatus}</TableCell>
                        <TableCell>
                          {[admission.responsibleName, admission.responsibleRelationship].filter(Boolean).join(' - ')}
                        </TableCell>
                        <TableCell>{formatDate(admission.birthDate)}</TableCell>
                        <TableCell>{admission.hasSis}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>{admission.address}</TableCell>
                        <TableCell>
                          {getAgeForGender(
                            admission.gender,
                            'male',
                            admission.birthDate,
                            admission.startDatetime,
                            ageLabels,
                          )}
                        </TableCell>
                        <TableCell>
                          {getAgeForGender(
                            admission.gender,
                            'female',
                            admission.birthDate,
                            admission.startDatetime,
                            ageLabels,
                          )}
                        </TableCell>
                        <TableCell>{admission.service}</TableCell>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{admission.communicationCondition}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!isLoading && filteredAdmissions.length === 0 ? (
                  <p className={styles.empty}>{t('noAdmissionsFound', 'No se encontraron atenciones recientes.')}</p>
                ) : null}
              </TableContainer>
            </Layer>
          </div>
        </main>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
