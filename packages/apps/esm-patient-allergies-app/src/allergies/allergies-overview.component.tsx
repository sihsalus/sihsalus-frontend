import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { AddIcon, useLayoutType, usePagination, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  launchPatientWorkspace,
  PatientChartPagination,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { allergiesCount, allergiesEditPrivilege, patientAllergiesFormWorkspace } from '../constants';
import styles from './allergies-overview.scss';
import { useAllergies } from './allergy-intolerance.resource';

interface AllergiesOverviewProps {
  basePath: string;
  patient: fhir.Patient;
}

const AllergiesOverview: React.FC<AllergiesOverviewProps> = ({ patient }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(allergiesEditPrivilege, session?.user);
  const displayText = t('allergyIntolerances', 'allergy intolerances');
  const headerTitle = t('allergies', 'Allergies');
  const urlLabel = t('seeAll', 'See all');
  const pageUrl = `${globalThis.spaBase}/patient/${patient.id}/chart/Allergies`;
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const _isDesktop = layout === 'small-desktop' || layout === 'large-desktop';

  const { allergies, error, isLoading, isValidating } = useAllergies(patient.id);
  const { results: paginatedAllergies, goTo, currentPage } = usePagination(allergies ?? [], allergiesCount);

  const tableHeaders = [
    {
      key: 'display',
      header: t('name', 'Name'),
    },
    {
      key: 'reactions',
      header: t('reactions', 'Reactions'),
    },
  ];

  const tableRows = useMemo(() => {
    return paginatedAllergies?.map((allergy) => ({
      ...allergy,
      reactions: `${allergy.reactionManifestations?.sort((a, b) => a.localeCompare(b))?.join(', ') || ''} ${
        allergy.reactionSeverity ? `(${t(allergy.reactionSeverity, allergy.reactionSeverity)})` : ''
      }`,
    }));
  }, [paginatedAllergies, t]);

  const launchAllergiesForm = useCallback(() => launchPatientWorkspace(patientAllergiesFormWorkspace), []);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (allergies?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          {canEdit ? (
            <Button
              kind="ghost"
              renderIcon={(props) => <AddIcon size={16} {...props} />}
              iconDescription="Add allergies"
              onClick={launchAllergiesForm}
            >
              {t('add', 'Add')}
            </Button>
          ) : null}
        </CardHeader>
        <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getTableProps }) => (
            <TableContainer>
              <Table aria-label="allergies overview" {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        key={header.key}
                        className={styles.tableHeader}
                        {...getHeaderProps({
                          header,
                        })}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        <PatientChartPagination
          currentItems={paginatedAllergies.length}
          onPageNumberChange={({ page }) => goTo(page)}
          pageNumber={currentPage}
          pageSize={allergiesCount}
          dashboardLinkUrl={pageUrl}
          dashboardLinkLabel={urlLabel}
          totalItems={allergies.length}
        />
      </div>
    );
  }
  return (
    <EmptyState
      displayText={displayText}
      headerTitle={headerTitle}
      launchForm={canEdit ? launchAllergiesForm : undefined}
    />
  );
};

export default AllergiesOverview;
