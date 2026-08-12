import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Layer,
  Pagination,
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
import {
  ConfigurableLink,
  ErrorState,
  formatDatetime,
  isDesktop,
  navigate,
  parseDate,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import {
  canCopyFinanciadorToVisit,
  copyFinanciadorToVisitPrivileges,
  isFinanciadorCopyAuthorizationError,
  safeCopyFinanciadorToVisit,
  type SafeCopyFinanciadorToVisitResult,
} from '@openmrs/esm-patient-common-lib';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../active-visits-widget/active-visits.scss';
import { EmptyDataIllustration } from '../active-visits-widget/empty-data-illustration.component';
import { type ActiveVisitsConfigSchema } from '../config-schema';
import {
  type PendingAccreditationStatus,
  type PendingSisVisit,
  usePendingSisAccreditations,
} from './pending-sis-accreditations.resource';

/**
 * La verificación de acreditación SIS es tarea de Admisión (Fase 6 del plan de
 * alineamiento de seguros); la lista de trabajo se muestra solo a ese rol.
 */
export const pendingSisAccreditationsPrivilege = 'app:home.admision';
export const editPatientInsurancePrivilege = 'app:opciones.registrarPaciente';
export const patientChartPrivilege = 'app:hoja.clinica';
export const syncPendingSisCoveragePrivileges = copyFinanciadorToVisitPrivileges;
export const canSyncPendingSisCoverage = canCopyFinanciadorToVisit;

const statusTagTypes: Record<PendingAccreditationStatus, 'blue' | 'gray' | 'red' | 'magenta'> = {
  pending: 'blue',
  notConsulted: 'gray',
  missing: 'red',
  unknown: 'red',
  missingInsuranceNumber: 'red',
  missingCheckedAt: 'red',
  // Highest urgency: without the payer on the visit no FUA can be generated at all.
  financiadorNotCopied: 'magenta',
};

const pendingSisContainerClassName = `${styles.activeVisitsContainer} ${styles.pendingSisAccreditationsContainer}`;

function AccreditationStatusTag({ status }: { status: PendingAccreditationStatus }) {
  const { t } = useTranslation();

  const labels: Record<PendingAccreditationStatus, string> = {
    pending: t('sisAccreditationPending', 'Pendiente'),
    notConsulted: t('sisAccreditationNotConsulted', 'No consultada'),
    missing: t('sisAccreditationMissing', 'Sin registrar'),
    unknown: t('sisAccreditationUnknown', 'Estado no reconocido'),
    missingInsuranceNumber: t('sisAccreditationMissingInsuranceNumber', 'Sin número de afiliación'),
    missingCheckedAt: t('sisAccreditationMissingCheckedAt', 'Sin fecha de acreditación'),
    financiadorNotCopied: t('sisFinanciadorNotCopied', 'Sin financiador en la visita'),
  };

  return (
    <Tag size="sm" type={statusTagTypes[status]}>
      {labels[status]}
    </Tag>
  );
}

const PendingSisAccreditationsTable = () => {
  const { t } = useTranslation();
  const session = useSession();
  const config = useConfig<ActiveVisitsConfigSchema>();
  const layout = useLayoutType();
  const pageSizes = config?.activeVisits?.pageSizes ?? [10, 20, 30, 40, 50];
  const [pageSize, setPageSize] = useState(config?.activeVisits?.pageSize ?? 10);
  const [syncingVisitUuid, setSyncingVisitUuid] = useState<string | null>(null);
  const [syncAuthorizationDenied, setSyncAuthorizationDenied] = useState(false);
  const canViewList = userHasAccess(pendingSisAccreditationsPrivilege, session?.user);
  const canEditPatientInsurance = userHasAccess(editPatientInsurancePrivilege, session?.user);
  const canAccessPatientChart = userHasAccess(patientChartPrivilege, session?.user);
  const canSyncCoverage = canSyncPendingSisCoverage(session?.user);
  const {
    pendingVisits,
    isLoading,
    isValidating,
    error,
    mutate: refreshPendingVisits,
  } = usePendingSisAccreditations(config.pendingSisAccreditations, canViewList);
  const { paginated, goTo, results, currentPage } = usePagination(pendingVisits, pageSize);

  const headerTitle = t('pendingSisAccreditations', 'Acreditaciones SIS pendientes');

  const headers = [
    { id: 0, key: 'patientName', header: t('patient', 'Paciente') },
    { id: 1, key: 'identifier', header: t('dni', 'DNI') },
    { id: 2, key: 'visitStartTime', header: t('visitStart', 'Hora de inicio') },
    { id: 3, key: 'accreditationStatus', header: t('accreditationStatus', 'Estado de acreditación') },
    { id: 4, key: 'location', header: t('location', 'UPSS') },
    { id: 5, key: 'actions', header: t('actions', 'Acciones') },
  ];

  const handleAccredit = (patientUuid: string) => {
    const afterUrl = encodeURIComponent(`${globalThis.spaBase}/home`);
    navigate({
      to: `${globalThis.spaBase}/patient/${patientUuid}/edit?focusSection=insurance&afterUrl=${afterUrl}`,
    });
  };

  const handleSyncCoverage = async (visit: PendingSisVisit) => {
    if (syncingVisitUuid) {
      return;
    }

    setSyncingVisitUuid(visit.visitUuid);
    const [sisConceptUuid, ...legacySisProductConceptUuids] = config.pendingSisAccreditations.sisConceptUuids;
    let result: SafeCopyFinanciadorToVisitResult;

    try {
      result = await safeCopyFinanciadorToVisit({
        patientUuid: visit.patientUuid,
        visitUuid: visit.visitUuid,
        // This is an explicit operator action after reviewing the affiliation:
        // the current person coverage is intentionally synchronized to the
        // visit, including replacing a former pending/conflicting snapshot.
        onlyFillMissing: false,
        sisConceptUuid,
        legacySisProductConceptUuids,
      });
    } catch (error) {
      // The safe helper should not reject, but keep the worklist recoverable if
      // a host provides an older or incompatible implementation.
      result = { ok: false, error };
    }

    try {
      // A failed copy may still have written part of the idempotent bundle, so
      // revalidate after every attempt and render the persisted server state.
      await refreshPendingVisits();
    } catch (refreshError) {
      console.error('Could not refresh pending SIS accreditations after synchronizing coverage', refreshError);
    } finally {
      setSyncingVisitUuid(null);
    }

    if (result.ok === false) {
      if (isFinanciadorCopyAuthorizationError(result.error)) {
        setSyncAuthorizationDenied(true);
        const reviewAction = canEditPatientInsurance
          ? {
              actionButtonLabel: t('reviewCoverage', 'Revisar cobertura'),
              onActionButtonClick: () => handleAccredit(visit.patientUuid),
            }
          : {};
        showSnackbar({
          isLowContrast: true,
          kind: 'warning',
          title: t('coverageSyncNotAuthorized', 'Sin permisos para sincronizar cobertura'),
          subtitle: t(
            'coverageSyncNotAuthorizedSubtitle',
            'Su rol no puede actualizar la cobertura de la consulta. Derive el caso a un usuario autorizado.',
          ),
          ...reviewAction,
        });
        return;
      }

      showSnackbar({
        isLowContrast: true,
        kind: 'error',
        title: t('coverageSyncFailed', 'No se pudo sincronizar la cobertura'),
        subtitle: t(
          'coverageSyncFailedSubtitle',
          'La consulta quedó pendiente. Puede volver a sincronizarla desde esta misma fila.',
        ),
      });
      return;
    }

    if (result.skipped || result.reviewReason) {
      const hasConflict = result.reviewReason === 'sis-accreditation-conflict';
      const isIncomplete = result.reviewReason === 'incomplete-coverage';
      const hasUnknownStatus = result.reviewReason === 'unknown-accreditation-status';
      const reviewAction = canEditPatientInsurance
        ? {
            actionButtonLabel: t('reviewCoverage', 'Revisar cobertura'),
            onActionButtonClick: () => handleAccredit(visit.patientUuid),
          }
        : {};

      showSnackbar({
        isLowContrast: true,
        kind: 'warning',
        title: hasConflict
          ? t('coverageSyncConflict', 'La acreditación SIS requiere revisión')
          : hasUnknownStatus
            ? t('coverageSyncUnknownStatus', 'Estado de acreditación SIS no reconocido')
            : isIncomplete
              ? t('coverageSyncIncomplete', 'La cobertura de la consulta sigue incompleta')
              : t('coverageSyncMissing', 'La consulta sigue sin financiador'),
        subtitle: hasConflict
          ? t(
              'coverageSyncConflictSubtitle',
              'El estado de la consulta no coincide con la afiliación. Revise la cobertura del paciente.',
            )
          : hasUnknownStatus
            ? t(
                'coverageSyncUnknownStatusSubtitle',
                'El estado sincronizado no pertenece al catálogo SIS. Corrija la acreditación del paciente.',
              )
            : isIncomplete
              ? t(
                  'coverageSyncIncompleteSubtitle',
                  'Complete el número de afiliación y, para SIS, el estado y la fecha de acreditación.',
                )
              : t('coverageSyncMissingSubtitle', 'Registre el financiador en la cobertura del paciente.'),
        ...reviewAction,
      });
      return;
    }

    showSnackbar({
      isLowContrast: true,
      kind: 'success',
      title: t('coverageSyncSuccess', 'Cobertura sincronizada'),
      subtitle: t('coverageSyncSuccessSubtitle', 'La cobertura se actualizó en esta misma consulta.'),
    });
  };

  if (!canViewList) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={pendingSisContainerClassName}>
        <div className={styles.activeVisitsDetailHeaderContainer}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{headerTitle}</h4>
          </div>
        </div>
        <DataTableSkeleton
          rowCount={pageSize}
          showHeader={false}
          showToolbar={false}
          zebra
          columnCount={headers.length}
          size={isDesktop(layout) ? 'sm' : 'lg'}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={pendingSisContainerClassName}>
        <Layer>
          <ErrorState error={error} headerTitle={headerTitle} />
        </Layer>
      </div>
    );
  }

  if (!pendingVisits.length) {
    return (
      <div className={pendingSisContainerClassName}>
        <Layer>
          <Tile className={styles.tile}>
            <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
              <h4>{headerTitle}</h4>
            </div>
            <EmptyDataIllustration />
            <p className={styles.content}>{t('noPendingSisAccreditations', 'No hay acreditaciones pendientes')}</p>
          </Tile>
        </Layer>
      </div>
    );
  }

  const renderCell = (visit: PendingSisVisit, key: string) => {
    switch (key) {
      case 'patientName':
        return visit.patientUuid && canAccessPatientChart ? (
          <ConfigurableLink to={`${globalThis.spaBase}/patient/${visit.patientUuid}/chart`}>
            {visit.patientName}
          </ConfigurableLink>
        ) : (
          visit.patientName
        );
      case 'identifier':
        return visit.identifier;
      case 'visitStartTime':
        return visit.startDatetime ? formatDatetime(parseDate(visit.startDatetime)) : '--';
      case 'accreditationStatus':
        return <AccreditationStatusTag status={visit.accreditationStatus} />;
      case 'location':
        return visit.location;
      case 'actions':
        return visit.patientUuid ? (
          <div className={styles.pendingSisActions}>
            {canSyncCoverage && !syncAuthorizationDenied && syncingVisitUuid === visit.visitUuid ? (
              <InlineLoading description={t('syncingCoverage', 'Sincronizando cobertura…')} />
            ) : canSyncCoverage && !syncAuthorizationDenied ? (
              <Button
                disabled={Boolean(syncingVisitUuid)}
                kind="ghost"
                size="sm"
                onClick={() => void handleSyncCoverage(visit)}
              >
                {t('syncCoverage', 'Sincronizar cobertura')}
              </Button>
            ) : null}
            {canEditPatientInsurance ? (
              <Button
                disabled={Boolean(syncingVisitUuid)}
                kind="ghost"
                size="sm"
                onClick={() => handleAccredit(visit.patientUuid)}
              >
                {t('accredit', 'Acreditar')}
              </Button>
            ) : null}
          </div>
        ) : (
          '--'
        );
      default:
        return null;
    }
  };

  return (
    <div className={pendingSisContainerClassName}>
      <div className={styles.activeVisitsDetailHeaderContainer}>
        <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{headerTitle}</h4>
        </div>
        <div className={styles.backgroundDataFetchingIndicator}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
        </div>
      </div>
      <DataTable
        useStaticWidth
        rows={results.map((visit) => ({ id: visit.visitUuid }))}
        headers={headers}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        useZebraStyles={pendingVisits.length > 1}
      >
        {({ headers: renderedHeaders, getHeaderProps, getTableProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table className={styles.activeVisitsTable} {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {renderedHeaders.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((visit) => (
                  <TableRow key={visit.visitUuid} data-testid={`pendingSisVisitRow-${visit.visitUuid}`}>
                    {headers.map((header) => (
                      <TableCell key={`${visit.visitUuid}-${header.key}`}>{renderCell(visit, header.key)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {paginated && (
        <Pagination
          forwardText={t('nextPage', 'Página siguiente')}
          backwardText={t('previousPage', 'Página anterior')}
          page={currentPage}
          pageSize={pageSize}
          pageSizes={pageSizes}
          totalItems={pendingVisits.length}
          className={styles.pagination}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          onChange={({ pageSize: newPageSize, page: newPage }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }
            if (newPage !== currentPage) {
              goTo(newPage);
            }
          }}
        />
      )}
    </div>
  );
};

export default PendingSisAccreditationsTable;
