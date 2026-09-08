import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Layer,
  Pagination,
  Select,
  SelectItem,
  SkeletonText,
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
  EmptyCardIllustration,
  PageHeader,
  PageHeaderContent,
  RegistrationPictogram,
  useConfig,
} from '@openmrs/esm-framework';
import { age } from '@openmrs/esm-utils';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookMergePrivileges, careLogbookPrivilege, moduleName } from '../constants';
import { useAdmissions } from '../resources/admissions.resource';
import styles from './admission-home.scss';

const EXCEL_CSV_PREAMBLE = '\uFEFFsep=,\r\n';

interface AdmissionConfig {
  admissionReportPageSize?: number;
}

function formatDate(value?: string) {
  if (!value) return '';
  const parsedDate = parseDate(value);
  return parsedDate ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(parsedDate) : '';
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const parsedDate = parseDate(value);
  return parsedDate
    ? new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Lima',
      }).format(parsedDate)
    : '';
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
    ? ['m', 'male', 'masculino', 'hombre'].includes(normalizedGender)
    : ['f', 'female', 'femenino', 'mujer'].includes(normalizedGender);
}

function formatSex(gender: string, labels: { female: string; male: string }) {
  if (matchesGender(gender, 'male')) {
    return labels.male;
  }

  if (matchesGender(gender, 'female')) {
    return labels.female;
  }

  return gender;
}

function formatAgeWithUnit(birthDate: string | undefined, referenceDate: string | undefined) {
  return birthDate ? (age(birthDate, referenceDate ?? new Date()) ?? '') : '';
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

interface CareLogbookTableEmptyStateProps {
  title: string;
  helper: string;
}

function CareLogbookTableEmptyState({ title, helper }: CareLogbookTableEmptyStateProps) {
  return (
    <div className={styles.emptyState} data-testid="care-logbook-empty-state" role="status">
      <div aria-hidden="true" data-testid="care-logbook-empty-state-illustration">
        <EmptyCardIllustration />
      </div>
      <p className={styles.emptyStateTitle}>{title}</p>
      <p className={styles.emptyStateHelper}>{helper}</p>
    </div>
  );
}

export default function AdmissionHome() {
  const { t } = useTranslation(moduleName);
  const config = useConfig() as AdmissionConfig;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const range = period === 'today' ? { from: today, to: today } : { from, to };
  const invalidRange = Boolean(range.from && range.to && range.from > range.to);
  const { admissions, error, isLoading } = useAdmissions(config.admissionReportPageSize ?? 50, range);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const availableServices = Array.from(new Set(admissions.map((item) => item.service).filter(Boolean))).sort();
  const availableLocations = Array.from(new Set(admissions.map((item) => item.location).filter(Boolean))).sort();
  const sexLabels = useMemo(
    () => ({
      female: t('femaleInitial', 'F'),
      male: t('maleInitial', 'M'),
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
          formatDateTime(admission.startDatetime),
          formatSex(admission.gender, sexLabels),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedSearchTerm);

      const matchesStatus = statusFilter === 'all' || admission.status === statusFilter;

      return (
        !invalidRange &&
        matchesSearch &&
        matchesStatus &&
        (serviceFilter === 'all' || admission.service === serviceFilter) &&
        (locationFilter === 'all' || admission.location === locationFilter)
      );
    });
  }, [admissions, searchTerm, sexLabels, statusFilter, serviceFilter, locationFilter, invalidRange]);
  const hasActiveFilters =
    Boolean(searchTerm.trim()) || statusFilter !== 'all' || serviceFilter !== 'all' || locationFilter !== 'all';
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredAdmissions.length / pageSize)));
  const visibleAdmissions = filteredAdmissions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const reportSummary = useMemo(
    () => ({
      total: filteredAdmissions.length,
      active: filteredAdmissions.filter((admission) => admission.status === 'Activa').length,
      finished: filteredAdmissions.filter((admission) => admission.status === 'Finalizada').length,
      visitTypes: new Set(filteredAdmissions.map((admission) => admission.service).filter(Boolean)).size,
    }),
    [filteredAdmissions],
  );

  const exportFilteredAdmissions = () => {
    const headers = [
      t('dateTime', 'Fecha y hora'),
      t('medicalRecordNumber', 'HCE / código temporal'),
      t('documentType', 'Tipo doc.'),
      t('documentNumber', 'N° documento'),
      t('identificationStatus', 'Estado identificación'),
      t('responsiblePerson', 'Responsable'),
      t('birthDateShort', 'F. Nac.'),
      t('hasSis', 'Tiene SIS'),
      t('fullName', 'Nombres y apellidos'),
      t('address', 'Dirección'),
      t('age', 'Edad'),
      t('sex', 'Sexo'),
      t('visitType', 'Tipo de visita'),
      t('location', 'UPSS'),
      t('orderNumber', 'Número de orden'),
      t('communicationCondition', 'Condición comunicación'),
    ];
    const rows = filteredAdmissions.map((admission, index) => [
      formatDateTime(admission.startDatetime),
      admission.medicalRecordNumber,
      admission.documentType || t('pending', 'Pendiente'),
      admission.documentNumber || t('pending', 'Pendiente'),
      admission.identificationStatus,
      [admission.responsibleName, admission.responsibleRelationship].filter(Boolean).join(' - '),
      formatDate(admission.birthDate),
      admission.hasSis,
      admission.patientName,
      admission.address,
      formatAgeWithUnit(admission.birthDate, admission.startDatetime),
      formatSex(admission.gender, sexLabels),
      admission.service,
      admission.location,
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
            <RequirePrivilege privilege={careLogbookMergePrivileges} hideUnauthorized>
              <ConfigurableLink to={`${spaBasePath}${careLogbookBasePath}/merge`} className={styles.headerAction}>
                <Button kind="secondary" renderIcon={Launch} as="span">
                  {t('mergeDuplicatePatients', 'Fusionar historias duplicadas')}
                </Button>
              </ConfigurableLink>
            </RequirePrivilege>
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
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error ? '—' : reportSummary.total}
                  </div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('activeAdmissions', 'En curso')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissions', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error ? '—' : reportSummary.active}
                  </div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('finishedAdmissions', 'Finalizadas')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissions', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error ? '—' : reportSummary.finished}
                  </div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>
                  {t('reportedVisitTypes', 'Tipos de visita reportados')}
                </header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('visitTypes', 'Tipos de visita')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error ? '—' : reportSummary.visitTypes}
                  </div>
                </div>
              </Tile>
            </section>

            <section
              className={styles.controls}
              aria-label={t('admissionReportFilters', 'Filtros del libro de atenciones')}
              onChange={() => setPage(1)}
            >
              <Select
                id="admission-period"
                labelText={t('period', 'Periodo')}
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <SelectItem value="today" text={t('today', 'Hoy')} />
                <SelectItem value="history" text={t('history', 'Histórico')} />
              </Select>
              {period === 'history' && (
                <>
                  <TextInput
                    id="admission-from"
                    type="date"
                    labelText={t('fromDate', 'Desde')}
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                  <TextInput
                    id="admission-to"
                    type="date"
                    labelText={t('toDate', 'Hasta')}
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    invalid={invalidRange}
                    invalidText={t('invalidDateRange', 'La fecha final debe ser igual o posterior a la inicial')}
                  />
                  <Button
                    kind="ghost"
                    onClick={() => {
                      setFrom('');
                      setTo('');
                      setPage(1);
                    }}
                  >
                    {t('allHistory', 'Todo el histórico')}
                  </Button>
                </>
              )}
              <Select
                id="admission-service"
                labelText={t('visitType', 'Tipo de visita')}
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
              >
                <SelectItem value="all" text={t('allVisitTypes', 'Todos los tipos de atención')} />
                {availableServices.map((service) => (
                  <SelectItem key={service} value={service} text={service} />
                ))}
              </Select>
              <Select
                id="admission-location"
                labelText={t('location', 'UPSS')}
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <SelectItem value="all" text={t('allLocations', 'Todas las UPSS')} />
                {availableLocations.map((location) => (
                  <SelectItem key={location} value={location} text={location} />
                ))}
              </Select>
              <TextInput
                id="admission-report-search"
                labelText={t(
                  'searchAdmissions',
                  'Buscar por paciente, documento, HCE, código temporal, seguro, responsable, tipo de visita o UPSS',
                )}
                placeholder={t(
                  'searchAdmissionsPlaceholder',
                  'Paciente, documento, HCE, seguro, responsable, servicio...',
                )}
                value={searchTerm}
                disabled={isLoading || Boolean(error)}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <Select
                id="admission-status-filter"
                labelText={t('filterByStatus', 'Filtrar por estado')}
                value={statusFilter}
                disabled={isLoading || Boolean(error)}
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
                disabled={isLoading || Boolean(error) || filteredAdmissions.length === 0}
              >
                {t('exportCsv', 'Exportar CSV')}
              </Button>
            </section>

            {error ? (
              <InlineNotification
                kind="error"
                lowContrast
                title={t('admissionReportError', 'No se pudo cargar el libro de atenciones')}
              />
            ) : null}

            <Layer>
              {isLoading ? (
                <div className={styles.tableSkeleton}>
                  <DataTableSkeleton
                    aria-label={t('loadingAdmissions', 'Cargando atenciones')}
                    columnCount={16}
                    rowCount={5}
                    role="progressbar"
                    zebra
                  />
                </div>
              ) : (
                <div className={styles.tableSurface}>
                  <TableContainer className={styles.tableWrap}>
                    <Table aria-label={t('reportedAdmissions', 'Atenciones registradas')} className={styles.table}>
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
                        <col className={styles.sexColumn} />
                        <col className={styles.serviceColumn} />
                        <col className={styles.serviceColumn} />
                        <col className={styles.orderColumn} />
                        <col className={styles.communicationColumn} />
                      </colgroup>
                      <TableHead>
                        <TableRow>
                          <TableHeader>{t('dateTime', 'Fecha y hora')}</TableHeader>
                          <TableHeader>{t('medicalRecordNumber', 'HCE / código temporal')}</TableHeader>
                          <TableHeader>{t('documentType', 'Tipo doc.')}</TableHeader>
                          <TableHeader>{t('documentNumber', 'N° documento')}</TableHeader>
                          <TableHeader>{t('identificationStatus', 'Estado identificación')}</TableHeader>
                          <TableHeader>{t('responsiblePerson', 'Responsable')}</TableHeader>
                          <TableHeader>{t('birthDateShort', 'F. Nac.')}</TableHeader>
                          <TableHeader>{t('hasSis', 'Tiene SIS')}</TableHeader>
                          <TableHeader>{t('fullName', 'Nombres y apellidos')}</TableHeader>
                          <TableHeader>{t('address', 'Dirección')}</TableHeader>
                          <TableHeader>{t('age', 'Edad')}</TableHeader>
                          <TableHeader>{t('sex', 'Sexo')}</TableHeader>
                          <TableHeader>{t('visitType', 'Tipo de visita')}</TableHeader>
                          <TableHeader>{t('location', 'UPSS')}</TableHeader>
                          <TableHeader>{t('orderNumber', 'Número de orden')}</TableHeader>
                          <TableHeader>{t('communicationCondition', 'Condición comunicación')}</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleAdmissions.map((admission, index) => (
                          <TableRow key={admission.uuid}>
                            <TableCell>{formatDateTime(admission.startDatetime)}</TableCell>
                            <TableCell>{admission.medicalRecordNumber}</TableCell>
                            <TableCell>{admission.documentType || t('pending', 'Pendiente')}</TableCell>
                            <TableCell>{admission.documentNumber || t('pending', 'Pendiente')}</TableCell>
                            <TableCell>{admission.identificationStatus}</TableCell>
                            <TableCell>
                              {[admission.responsibleName, admission.responsibleRelationship]
                                .filter(Boolean)
                                .join(' - ')}
                            </TableCell>
                            <TableCell>{formatDate(admission.birthDate)}</TableCell>
                            <TableCell>{admission.hasSis}</TableCell>
                            <TableCell>
                              {admission.patientUuid ? (
                                <ConfigurableLink
                                  to={`${spaBasePath}${careLogbookBasePath}/patient/${admission.patientUuid}`}
                                  className={styles.patientLink}
                                >
                                  {admission.patientName}
                                </ConfigurableLink>
                              ) : (
                                admission.patientName
                              )}
                            </TableCell>
                            <TableCell>{admission.address}</TableCell>
                            <TableCell>{formatAgeWithUnit(admission.birthDate, admission.startDatetime)}</TableCell>
                            <TableCell>{formatSex(admission.gender, sexLabels)}</TableCell>
                            <TableCell>{admission.service}</TableCell>
                            <TableCell>{admission.location}</TableCell>
                            <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                            <TableCell>{admission.communicationCondition}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Pagination
                    page={currentPage}
                    pageSize={pageSize}
                    pageSizes={[25, 50, 100]}
                    totalItems={filteredAdmissions.length}
                    itemsPerPageText={t('itemsPerPage', 'Elementos por página')}
                    backwardText={t('previousPage', 'Página anterior')}
                    forwardText={t('nextPage', 'Página siguiente')}
                    onChange={({ page, pageSize }) => {
                      setPage(page);
                      setPageSize(pageSize);
                    }}
                  />
                  {!error && filteredAdmissions.length === 0 ? (
                    <CareLogbookTableEmptyState
                      title={
                        hasActiveFilters
                          ? t('noMatchingAdmissions', 'No hay atenciones que coincidan')
                          : t('noAdmissionsFound', 'No hay atenciones recientes para mostrar')
                      }
                      helper={
                        hasActiveFilters
                          ? t('checkFilters', 'Comprobar los filtros anteriores')
                          : t('noAdmissionsFoundHint', 'Las atenciones registradas aparecerán aquí')
                      }
                    />
                  ) : null}
                </div>
              )}
            </Layer>
          </div>
        </main>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
