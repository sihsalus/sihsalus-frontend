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
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
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
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookPrivilege, moduleName } from '../constants';
import { type AdmissionRow, useAdmissions } from '../resources/admissions.resource';
import styles from './admission-home.scss';

const EXCEL_CSV_PREAMBLE = '\uFEFFsep=,\r\n';

interface AdmissionConfig {
  admissionReportPageSize?: number;
}

type ReportPeriod = 'today' | 'range' | 'all';

function getLastThirtyDaysStart(today: string) {
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 29)).toISOString().slice(0, 10);
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

function getVisibleDocumentType(documentType: string) {
  const type = documentType.trim();
  if (/^dni$|documento nacional de identidad/i.test(type)) return 'DNI';
  if (/^ce$|carn[eé].*extranjer/i.test(type)) return 'CE';
  return type;
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

function AdmissionTableRow({
  admission,
  rowNumber,
  statusLabel,
  sexLabels,
  spaBasePath,
}: {
  admission: AdmissionRow;
  rowNumber: number;
  statusLabel: string;
  sexLabels: { female: string; male: string };
  spaBasePath: string;
}) {
  const { t } = useTranslation(moduleName);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const expandLabel = expanded
    ? t('hideAdmissionDetails', 'Ocultar detalles de {{patient}}', { patient: admission.patientName })
    : t('showAdmissionDetails', 'Ver detalles de {{patient}}', { patient: admission.patientName });
  const details = [
    [t('documentType', 'Tipo doc.'), admission.documentType],
    [t('documentNumber', 'N° documento'), admission.documentNumber],
    [t('identificationStatus', 'Estado identificación'), admission.identificationStatus],
    [
      t('responsiblePerson', 'Responsable'),
      [admission.responsibleName, admission.responsibleRelationship].filter(Boolean).join(' - '),
    ],
    [t('birthDateShort', 'F. Nac.'), formatDate(admission.birthDate)],
    [t('age', 'Edad'), formatAgeWithUnit(admission.birthDate, admission.startDatetime)],
    [t('sex', 'Sexo'), formatSex(admission.gender, sexLabels)],
    [t('address', 'Dirección'), admission.address],
    [t('communicationCondition', 'Condición comunicación'), admission.communicationCondition],
    [t('reportRowNumber', 'N° de fila del reporte'), String(rowNumber)],
  ];

  return (
    <>
      <TableExpandRow
        isExpanded={expanded}
        onExpand={() => setExpanded((value) => !value)}
        aria-label={expandLabel}
        aria-controls={detailsId}
        expandHeader="admission-expand"
        expandIconDescription={expandLabel}
      >
        <TableCell>{formatDateTime(admission.startDatetime)}</TableCell>
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
          <span className={styles.patientIdentifier}>
            {t('medicalRecordNumber', 'HCE / código temporal')}: {admission.medicalRecordNumber || '—'}
          </span>
          {admission.documentNumber.trim() && (
            <span className={styles.patientIdentifier}>
              {getVisibleDocumentType(admission.documentType) || t('documentNumber', 'N° documento')}:{' '}
              {admission.documentNumber}
            </span>
          )}
        </TableCell>
        <TableCell>{admission.service || '—'}</TableCell>
        <TableCell>{admission.location || '—'}</TableCell>
        <TableCell>
          <Tag type={admission.status === 'Activa' ? 'blue' : 'gray'} size="sm">
            {statusLabel}
          </Tag>
        </TableCell>
        <TableCell>{admission.hasSis}</TableCell>
      </TableExpandRow>
      <TableExpandedRow id={detailsId} colSpan={7} hidden={!expanded}>
        {expanded && (
          <dl className={styles.admissionDetails}>
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || t('notRecorded', 'Sin registrar')}</dd>
              </div>
            ))}
          </dl>
        )}
      </TableExpandedRow>
    </>
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
  const initialFrom = getLastThirtyDaysStart(today);
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const range = period === 'today' ? { from: today, to: today } : period === 'all' ? { from: '', to: '' } : { from, to };
  const missingRange = period === 'range' && (!from || !to);
  const invalidRange = period === 'range' && Boolean(from && to && from > to);
  const validRange = !missingRange && !invalidRange;
  const { admissions, error, isLoading } = useAdmissions(config.admissionReportPageSize ?? 50, range, validRange);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const availableServices = Array.from(
    new Set([...admissions.map((item) => item.service).filter(Boolean), ...(serviceFilter === 'all' ? [] : [serviceFilter])]),
  ).sort();
  const availableLocations = Array.from(
    new Set([...admissions.map((item) => item.location).filter(Boolean), ...(locationFilter === 'all' ? [] : [locationFilter])]),
  ).sort();
  const sexLabels = useMemo(
    () => ({
      female: t('femaleInitial', 'F'),
      male: t('maleInitial', 'M'),
    }),
    [t],
  );
  const visitStatusLabels: Record<string, string> = {
    Activa: t('activeVisitStatus', 'En curso'),
    Finalizada: t('finishedVisitStatus', 'Finalizada'),
  };

  const availableStatuses = useMemo(
    () =>
      Array.from(
        new Set([
          ...admissions.map((admission) => admission.status).filter(Boolean),
          ...(statusFilter === 'all' ? [] : [statusFilter]),
        ]),
      ).sort(),
    [admissions, statusFilter],
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
        validRange &&
        matchesSearch &&
        matchesStatus &&
        (serviceFilter === 'all' || admission.service === serviceFilter) &&
        (locationFilter === 'all' || admission.location === locationFilter)
      );
    });
  }, [admissions, searchTerm, sexLabels, statusFilter, serviceFilter, locationFilter, validRange]);
  const hasFacetFilters =
    Boolean(searchTerm.trim()) || statusFilter !== 'all' || serviceFilter !== 'all' || locationFilter !== 'all';
  const hasActiveFilters = period !== 'today' || hasFacetFilters;
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
      t('visitStatus', 'Estado de atención'),
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
      visitStatusLabels[admission.status] ?? admission.status,
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
                  <div className={styles.summaryTileLabel}>{t('admissionCountUnit', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error || !validRange ? '—' : reportSummary.total}
                  </div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('activeAdmissions', 'En curso')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissionCountUnit', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error || !validRange ? '—' : reportSummary.active}
                  </div>
                </div>
              </Tile>
              <Tile className={styles.summaryTile}>
                <header className={styles.summaryTileHeader}>{t('finishedAdmissions', 'Finalizadas')}</header>
                <div className={styles.summaryTileDetails}>
                  <div className={styles.summaryTileLabel}>{t('admissionCountUnit', 'Atenciones')}</div>
                  <div className={styles.summaryTileValue}>
                    {isLoading ? <SkeletonText width="2rem" /> : error || !validRange ? '—' : reportSummary.finished}
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
                    {isLoading ? <SkeletonText width="2rem" /> : error || !validRange ? '—' : reportSummary.visitTypes}
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
                onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
              >
                <SelectItem value="today" text={t('today', 'Hoy')} />
                <SelectItem value="range" text={t('dateRange', 'Rango de fechas')} />
                <SelectItem value="all" text={t('allHistory', 'Todo el histórico')} />
              </Select>
              {period === 'range' && (
                <>
                  <TextInput
                    id="admission-from"
                    type="date"
                    labelText={t('fromDate', 'Desde')}
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    invalid={!from}
                    invalidText={t('dateRequired', 'Seleccione una fecha')}
                  />
                  <TextInput
                    id="admission-to"
                    type="date"
                    labelText={t('toDate', 'Hasta')}
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    invalid={!to || invalidRange}
                    invalidText={
                      invalidRange
                        ? t('invalidDateRange', 'La fecha final debe ser igual o posterior a la inicial')
                        : t('dateRequired', 'Seleccione una fecha')
                    }
                  />
                </>
              )}
              <Select
                id="admission-service"
                labelText={t('visitType', 'Tipo de visita')}
                value={serviceFilter}
                disabled={isLoading || Boolean(error) || !validRange}
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
                disabled={isLoading || Boolean(error) || !validRange}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <SelectItem value="all" text={t('allLocations', 'Todas las UPSS')} />
                {availableLocations.map((location) => (
                  <SelectItem key={location} value={location} text={location} />
                ))}
              </Select>
              <Select
                id="admission-status-filter"
                labelText={t('filterByStatus', 'Filtrar por estado')}
                value={statusFilter}
                disabled={isLoading || Boolean(error) || !validRange}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <SelectItem value="all" text={t('allStatuses', 'Todos los estados')} />
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status} text={visitStatusLabels[status] ?? status} />
                ))}
              </Select>
              <TextInput
                id="admission-report-search"
                className={styles.searchControl}
                labelText={t('searchAdmissions', 'Buscar atención')}
                placeholder={t(
                  'searchAdmissionsPlaceholder',
                  'Paciente, DNI, HCE, código temporal o responsable',
                )}
                helperText={t('searchAdmissionsHint', 'Busca dentro del periodo seleccionado; incluye seguro, tipo y UPSS.')}
                value={searchTerm}
                disabled={isLoading || Boolean(error) || !validRange}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <div className={styles.reportActions}>
                <Button
                  kind="ghost"
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setPeriod('today');
                    setFrom(initialFrom);
                    setTo(today);
                    setSearchTerm('');
                    setServiceFilter('all');
                    setLocationFilter('all');
                    setStatusFilter('all');
                    setPage(1);
                  }}
                >
                  {t('clearFilters', 'Limpiar filtros')}
                </Button>
                <Button
                  kind="primary"
                  renderIcon={Download}
                  onClick={exportFilteredAdmissions}
                  disabled={isLoading || Boolean(error) || !validRange || filteredAdmissions.length === 0}
                >
                  {t('exportCsv', 'Exportar CSV')}
                </Button>
              </div>
            </section>

            {error ? (
              <InlineNotification
                kind="error"
                lowContrast
                title={t('admissionReportError', 'No se pudo cargar el libro de atenciones')}
              />
            ) : null}

            <Layer>
              {!validRange ? (
                <CareLogbookTableEmptyState
                  title={t('selectValidDateRange', 'Selecciona un rango de fechas válido')}
                  helper={t('selectValidDateRangeHint', 'Completa ambas fechas para consultar las atenciones.')}
                />
              ) : isLoading ? (
                <div className={styles.tableSkeleton}>
                  <DataTableSkeleton
                    aria-label={t('loadingAdmissions', 'Cargando atenciones')}
                    columnCount={7}
                    rowCount={5}
                    role="progressbar"
                    zebra
                  />
                </div>
              ) : (
                <div className={styles.tableSurface}>
                  <TableContainer
                    className={styles.tableWrap}
                    description={t(
                      'admissionDetailsHint',
                      'Despliega una atención para ver responsable y datos complementarios.',
                    )}
                  >
                    <Table
                      aria-label={t('reportedAdmissions', 'Atenciones registradas')}
                      className={styles.table}
                      useZebraStyles
                    >
                      <colgroup>
                        <col className={styles.expandColumn} />
                        <col className={styles.dateColumn} />
                        <col className={styles.personColumn} />
                        <col />
                        <col />
                        <col className={styles.statusColumn} />
                        <col className={styles.sisColumn} />
                      </colgroup>
                      <TableHead>
                        <TableRow>
                          <TableExpandHeader id="admission-expand">
                            <span className={styles.visuallyHidden}>
                              {t('admissionDetails', 'Detalles de atención')}
                            </span>
                          </TableExpandHeader>
                          <TableHeader>{t('dateTime', 'Fecha y hora')}</TableHeader>
                          <TableHeader>{t('patient', 'Paciente')}</TableHeader>
                          <TableHeader>{t('visitType', 'Tipo de visita')}</TableHeader>
                          <TableHeader>{t('location', 'UPSS')}</TableHeader>
                          <TableHeader>{t('visitStatus', 'Estado de atención')}</TableHeader>
                          <TableHeader>{t('hasSis', 'Tiene SIS')}</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleAdmissions.map((admission, index) => (
                          <AdmissionTableRow
                            key={admission.uuid}
                            admission={admission}
                            rowNumber={(currentPage - 1) * pageSize + index + 1}
                            statusLabel={visitStatusLabels[admission.status] ?? admission.status}
                            sexLabels={sexLabels}
                            spaBasePath={spaBasePath}
                          />
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
                        hasFacetFilters
                          ? t('noMatchingAdmissions', 'No hay atenciones que coincidan')
                          : period === 'today'
                            ? t('noAdmissionsFound', 'No hay atenciones recientes para mostrar')
                            : t('noAdmissionsInPeriod', 'No hay atenciones en el periodo seleccionado')
                      }
                      helper={
                        hasFacetFilters
                          ? t('checkFilters', 'Comprobar los filtros anteriores')
                          : period === 'today'
                            ? t('noAdmissionsFoundHint', 'Las atenciones registradas aparecerán aquí')
                            : t('tryAnotherPeriod', 'Prueba con otro rango de fechas o periodo')
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
