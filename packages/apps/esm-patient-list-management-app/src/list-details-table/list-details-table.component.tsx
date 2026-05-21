import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Layer,
  Modal,
  Pagination,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { ArrowLeft, TrashCan } from '@carbon/react/icons';
import { ConfigurableLink, isDesktop, showSnackbar, useDebounce, useLayoutType } from '@openmrs/esm-framework';
import fuzzy from 'fuzzy';
import React, { type CSSProperties, useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { removePatientFromList } from '../api/api-remote';
import { EmptyDataIllustration } from '../empty-state/empty-data-illustration.component';

import styles from './list-details-table.scss';

export interface PatientRow {
  identifier?: string | null;
  membershipUuid?: string;
  mobile?: string | null;
  name?: string;
  sex?: string;
  startDate?: string | null;
  uuid?: string;
}

interface ListDetailsTableProps {
  autoFocus?: boolean;
  columns: Array<PatientTableColumn>;
  isFetching?: boolean;
  isLoading: boolean;
  mutateListDetails: () => void;
  mutateListMembers: () => void;
  pagination: {
    usePagination: boolean;
    currentPage: number;
    onChange(params: { page: number; pageSize: number }): void;
    pageSize: number;
    totalItems: number;
    pagesUnknown?: boolean;
    lastPage?: boolean;
  };
  patients: Array<PatientRow>;
  style?: CSSProperties;
}

interface PatientTableColumn {
  key: string;
  header: string;
  getValue?(patient: PatientRow): unknown;
  link?: {
    getUrl(patient: PatientRow): string;
  };
}

const ListDetailsTable: React.FC<ListDetailsTableProps> = ({
  columns,
  isFetching,
  isLoading,
  mutateListDetails,
  mutateListMembers,
  pagination,
  patients,
}) => {
  const { t } = useTranslation();
  const id = useId();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const patientListsPath = globalThis.getOpenmrsSpaBase() + 'home/patient-lists';
  const linkClassName = typeof styles.link === 'string' ? styles.link : undefined;
  const searchClassName = typeof styles.searchOverrides === 'string' ? styles.searchOverrides : undefined;
  const desktopHeaderClassName = typeof styles.desktopHeader === 'string' ? styles.desktopHeader : undefined;
  const tabletHeaderClassName = typeof styles.tabletHeader === 'string' ? styles.tabletHeader : undefined;
  const desktopRowClassName = typeof styles.desktopRow === 'string' ? styles.desktopRow : undefined;
  const tabletRowClassName = typeof styles.tabletRow === 'string' ? styles.tabletRow : undefined;

  const [isDeleting, setIsDeleting] = useState(false);
  const [membershipUuid, setMembershipUuid] = useState('');
  const [patientName, setPatientName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm);

  const filteredPatients = useMemo(() => {
    if (!debouncedSearchTerm) {
      return patients;
    }

    return debouncedSearchTerm
      ? fuzzy
          .filter(debouncedSearchTerm, patients, {
            extract: (patient: PatientRow) => `${patient.name} ${patient.identifier} ${patient.sex}`,
          })
          .sort((r1, r2) => r1.score - r2.score)
          .map((result) => result.original)
      : patients;
  }, [debouncedSearchTerm, patients]);

  const renderCellValue = (value: React.ReactNode) => {
    if (value && typeof value === 'object' && 'content' in value) {
      return value.content as React.ReactNode;
    }

    return value;
  };

  const tableRows = useMemo(
    () =>
      filteredPatients?.map((patient) => ({
        id: patient.identifier,
        identifier: patient.identifier,
        membershipUuid: patient.membershipUuid,
        name: columns.find((column) => column.key === 'name')?.link ? (
          <ConfigurableLink
            className={linkClassName}
            to={columns.find((column) => column.key === 'name')?.link?.getUrl(patient)}
          >
            {patient.name}
          </ConfigurableLink>
        ) : (
          patient.name
        ),
        sex: patient.sex,
        startDate: patient.startDate,
        mobile: patient.mobile || '--',
      })) ?? [],
    [columns, filteredPatients, linkClassName],
  );

  const handleRemovePatientFromList = useCallback(async () => {
    setIsDeleting(true);

    try {
      await removePatientFromList(membershipUuid);
      mutateListMembers();
      mutateListDetails();

      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('listUpToDate', 'The list is now up to date'),
        title: t('patientRemovedFromList', 'Patient removed from list'),
      });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        subtitle: error?.message,
        title: t('errorRemovingPatientFromList', 'Failed to remove patient from list'),
      });
    }

    setIsDeleting(false);
    setShowConfirmationModal(false);
  }, [membershipUuid, mutateListDetails, mutateListMembers, t]);

  const BackButton = () => (
    <div className={styles.backButton}>
      <ConfigurableLink to={patientListsPath}>
        <Button
          kind="ghost"
          renderIcon={(props) => <ArrowLeft size={24} {...props} />}
          iconDescription="Return to lists page"
          size="sm"
          onClick={() => {}}
        >
          <span>{t('backToListsPage', 'Back to lists page')}</span>
        </Button>
      </ConfigurableLink>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <DataTableSkeleton
          data-testid="data-table-skeleton"
          className={styles.dataTableSkeleton}
          rowCount={5}
          columnCount={5}
          zebra
        />
      </div>
    );
  }

  if (patients.length > 0) {
    return (
      <>
        <BackButton />
        <div className={styles.tableOverride}>
          <div className={styles.searchContainer}>
            <div>{isFetching && <InlineLoading />}</div>
            <div>
              <Layer>
                <Search
                  className={searchClassName}
                  id={`${id}-search`}
                  labelText=""
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder={t('searchThisList', 'Search this list')}
                  size={responsiveSize}
                />
              </Layer>
            </div>
          </div>
          <DataTable rows={tableRows} headers={columns} isSortable size={responsiveSize} useZebraStyles>
            {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
              <TableContainer>
                <Table className={styles.table} {...getTableProps()} data-testid="patientsTable">
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => {
                        const { key, ...headerProps } = getHeaderProps({
                          header,
                          isSortable: header.isSortable,
                        });
                        return (
                          <TableHeader
                            key={key}
                            {...headerProps}
                            className={isDesktop(layout) ? desktopHeaderClassName : tabletHeaderClassName}
                          >
                            {header.header}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const currentPatient = patients.find((patient) => patient.identifier === row.id);
                      const { key, ...rowProps } = getRowProps({ row });

                      return (
                        <TableRow
                          {...rowProps}
                          className={isDesktop(layout) ? desktopRowClassName : tabletRowClassName}
                          key={key}
                        >
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{renderCellValue(cell.value)}</TableCell>
                          ))}
                          <TableCell className="cds--table-column-menu">
                            <Button
                              kind="ghost"
                              hasIconOnly
                              renderIcon={TrashCan}
                              iconDescription={t('removeFromList', 'Remove from list')}
                              size={responsiveSize}
                              tooltipPosition="left"
                              onClick={() => {
                                setMembershipUuid(currentPatient.membershipUuid);
                                setPatientName(currentPatient.name);
                                setShowConfirmationModal(true);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          {filteredPatients?.length === 0 && (
            <div className={styles.filterEmptyState}>
              <Layer level={0}>
                <Tile className={styles.filterEmptyStateTile}>
                  <p className={styles.filterEmptyStateContent}>
                    {t('noMatchingPatients', 'No matching patients to display')}
                  </p>
                  <p className={styles.filterEmptyStateHelper}>{t('checkFilters', 'Check the filters above')}</p>
                </Tile>
              </Layer>
            </div>
          )}
          {pagination.usePagination && (
            <Pagination
              backwardText={t('nextPage', 'Next page')}
              className={styles.paginationOverride}
              forwardText={t('previousPage', 'Previous page')}
              isLastPage={pagination.lastPage}
              onChange={pagination.onChange}
              page={pagination.currentPage}
              pageSize={pagination.pageSize}
              pageSizes={[10, 20, 30, 40, 50]}
              pagesUnknown={pagination?.pagesUnknown}
              totalItems={pagination.totalItems}
            />
          )}
        </div>
        {showConfirmationModal && (
          <Modal
            className={styles.modal}
            open
            danger
            modalHeading={t(
              'removePatientFromListConfirmation',
              'Are you sure you want to remove {{patientName}} from this list?',
              {
                patientName: patientName,
              },
            )}
            primaryButtonText={t('removeFromList', 'Remove from list')}
            secondaryButtonText={t('cancel', 'Cancel')}
            onRequestClose={() => setShowConfirmationModal(false)}
            onRequestSubmit={handleRemovePatientFromList}
            primaryButtonDisabled={isDeleting}
          />
        )}
      </>
    );
  }

  return (
    <>
      <BackButton />
      <Layer>
        <Tile className={styles.tile} data-openmrs-role="Patient Empty tile">
          <div className={styles.illo}>
            <EmptyDataIllustration />
          </div>
          <p className={styles.content}>{t('noPatientsInList', 'There are no patients in this list')}</p>
        </Tile>
      </Layer>
    </>
  );
};

export default ListDetailsTable;
