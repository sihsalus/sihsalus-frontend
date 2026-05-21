import {
  DataTable,
  DataTableSkeleton,
  Layer,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { useLayoutType, usePagination } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import DyakuPatientSyncButton from './dyaku-patient-sync-button.component';
import {
  DNI_SYSTEM,
  type DyakuPatient,
  useDyakuPatients,
  useDyakuPatientsByIdentifier,
} from './dyaku-patients.resource';
import DyakuPatientsSync from './dyaku-patients-sync.component';
import styles from './dyaku-patients-table.scss';

interface DyakuPatientsTableProps {
  pageSize?: number;
  searchDni?: string;
}

type DyakuPatientsTableRow = {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  email: string;
  phone: string;
  actions: DyakuPatient;
};

const PAGE_SIZES = [10, 20, 30];

const DyakuPatientsTable: React.FC<DyakuPatientsTableProps> = ({ pageSize: initialPageSize = 10, searchDni }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [tableSearch, setTableSearch] = useState('');

  const isSearchMode = Boolean(searchDni && searchDni.trim().length >= 8);

  const {
    data: allPatients,
    error: allPatientsError,
    isLoading: isLoadingAll,
    mutate: mutateAll,
  } = useDyakuPatients(undefined, pageSize);

  const {
    data: searchResults,
    error: searchError,
    isLoading: isSearching,
    mutate: mutateSearch,
  } = useDyakuPatientsByIdentifier(searchDni || '');

  const patients = isSearchMode ? searchResults : allPatients;
  const error = isSearchMode ? searchError : allPatientsError;
  const isLoading = isSearchMode ? isSearching : isLoadingAll;
  const mutate = isSearchMode ? mutateSearch : mutateAll;

  const tableHeaders: Array<{ key: string; header: string }> = [
    { key: 'dni', header: t('dni', 'DNI') },
    { key: 'firstName', header: t('firstName', 'Nombres') },
    { key: 'lastName', header: t('lastName', 'Apellidos') },
    { key: 'gender', header: t('gender', 'Género') },
    { key: 'birthDate', header: t('birthDate', 'Fecha de Nacimiento') },
    { key: 'email', header: t('email', 'Email') },
    { key: 'phone', header: t('phone', 'Teléfono') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const allRows: Array<DyakuPatientsTableRow> = patients
    ? patients.map((patient, index) => ({
        id: patient.id || `patient-${index}`,
        dni:
          patient.identifier?.find(
            (identifier) => identifier.system === DNI_SYSTEM || identifier.type?.coding?.some((c) => c.code === 'DNI'),
          )?.value ??
          patient.identifier?.[0]?.value ??
          '-',
        firstName: patient.name?.[0]?.given?.join(' ') || '-',
        lastName: patient.name?.[0]?.family || '-',
        gender:
          patient.gender === 'female'
            ? t('female', 'Femenino')
            : patient.gender === 'male'
              ? t('male', 'Masculino')
              : '-',
        birthDate: patient.birthDate || '-',
        email: patient.telecom?.find((tc) => tc.system === 'email')?.value || '-',
        phone: patient.telecom?.find((tc) => tc.system === 'phone')?.value || '-',
        actions: patient,
      }))
    : [];

  const filteredRows = tableSearch
    ? allRows.filter(
        (row) =>
          row.dni.toLowerCase().includes(tableSearch.toLowerCase()) ||
          row.firstName.toLowerCase().includes(tableSearch.toLowerCase()) ||
          row.lastName.toLowerCase().includes(tableSearch.toLowerCase()),
      )
    : allRows;

  const {
    results: paginatedData,
    goTo,
    currentPage,
  } = usePagination(filteredRows, pageSize) as {
    results: Array<DyakuPatientsTableRow>;
    goTo: (page: number) => void;
    currentPage: number;
  };

  const handleSyncComplete = () => {
    void mutate();
  };

  if (isSearchMode && (!patients || patients.length === 0) && !isLoading && !error) {
    return null;
  }

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} columnCount={8} rowCount={5} />;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        {t('errorLoadingPatients', 'Error al cargar los pacientes: {{error}}', { error: error.message })}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <div className={styles.headerContent}>
          <div>
            <h2 className={styles.title}>
              {isSearchMode
                ? t('dyakuPatientsSearchTitle', 'Resultados de búsqueda - Pacientes FHIR Dyaku MINSA')
                : t('dyakuPatientsTitle', 'Pacientes FHIR - Dyaku MINSA')}
            </h2>
            <p className={styles.subtitle}>
              {isSearchMode
                ? t(
                    'dyakuPatientsSearchSubtitle',
                    'Resultados para DNI: {{dni}} ({{total}} paciente(s) encontrado(s))',
                    { dni: searchDni, total: patients?.length || 0 },
                  )
                : t('dyakuPatientsSubtitle', 'Lista de pacientes registrados en el sistema FHIR del MINSA')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <DyakuPatientsSync onSyncComplete={handleSyncComplete} />
          </div>
        </div>
      </div>

      <DataTable rows={paginatedData} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles isSortable>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar>
              <TableToolbarContent>
                <Layer>
                  <TableToolbarSearch
                    expanded
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTableSearch(e.target.value)}
                    placeholder={t('searchThisList', 'Buscar por DNI o nombre...')}
                    size="sm"
                  />
                </Layer>
              </TableToolbarContent>
            </TableToolbar>
            <Table className={styles.table} aria-label="dyaku-patients-table" {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.info.header === 'actions' ? (
                          <DyakuPatientSyncButton
                            patient={paginatedData[rowIndex].actions}
                            onSyncComplete={handleSyncComplete}
                            size="sm"
                          />
                        ) : typeof cell.value === 'string' ? (
                          cell.value
                        ) : (
                          ''
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRows.length === 0 && (
              <Tile className={styles.emptyState}>
                <p>{t('noPatients', 'No se encontraron pacientes')}</p>
              </Tile>
            )}
          </TableContainer>
        )}
      </DataTable>

      {filteredRows.length > pageSize && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          totalItems={filteredRows.length}
          onChange={({ page, pageSize: newPageSize }: { page: number; pageSize: number }) => {
            if (newPageSize !== pageSize) setPageSize(newPageSize);
            goTo(page);
          }}
        />
      )}
    </div>
  );
};

export default DyakuPatientsTable;
