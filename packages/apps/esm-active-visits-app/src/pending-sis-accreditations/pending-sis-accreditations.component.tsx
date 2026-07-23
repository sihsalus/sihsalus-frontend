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
  useConfig,
  useLayoutType,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
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

const statusTagTypes: Record<PendingAccreditationStatus, 'blue' | 'gray' | 'red'> = {
  pending: 'blue',
  notConsulted: 'gray',
  missing: 'red',
};

const pendingSisContainerClassName = `${styles.activeVisitsContainer} ${styles.pendingSisAccreditationsContainer}`;

function AccreditationStatusTag({ status }: { status: PendingAccreditationStatus }) {
  const { t } = useTranslation();

  const labels: Record<PendingAccreditationStatus, string> = {
    pending: t('sisAccreditationPending', 'Pendiente'),
    notConsulted: t('sisAccreditationNotConsulted', 'No consultada'),
    missing: t('sisAccreditationMissing', 'Sin registrar'),
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
  const canViewList = userHasAccess(pendingSisAccreditationsPrivilege, session?.user);
  const { pendingVisits, isLoading, isValidating, error } = usePendingSisAccreditations(
    config.pendingSisAccreditations,
    canViewList,
  );
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
        return visit.patientUuid ? (
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
          <Button kind="ghost" size="sm" onClick={() => handleAccredit(visit.patientUuid)}>
            {t('accredit', 'Acreditar')}
          </Button>
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
