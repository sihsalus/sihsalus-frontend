import {
  Button,
  DataTable,
  DataTableSkeleton,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/react/icons';
import { ConfigurableLink, isDesktop, useConfig, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { CardHeader, EmptyDataIllustration, ErrorState, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import ConceptObservations from '../family-partner-history/concept-obs.component';
import { usePatientRelationships } from '../family-partner-history/relationships.resource';
import { deleteRelationship } from '../relationships/relationship.resources';
import { launchFichaFamiliarWorkspace } from '../workspace-utils';

import styles from './other-relationships.scss';

interface OtherRelationshipsProps {
  patientUuid: string;
}

const renderHeaderLabel = (header: React.ReactNode): React.ReactNode =>
  typeof header === 'object' && header !== null && 'content' in header
    ? (header as { content: React.ReactNode }).content
    : header;

export const OtherRelationships: React.FC<OtherRelationshipsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const layout = useLayoutType();
  const { concepts, familyRelationshipsTypeList } = config;
  const [pageSize, setPageSize] = useState(10);

  const { relationships, error, isLoading, isValidating } = usePatientRelationships(patientUuid);
  const familyRelationshipTypeUUIDs = new Set(familyRelationshipsTypeList.map((type) => type.uuid));
  const nonFamilyRelationships = relationships.filter((r) => !familyRelationshipTypeUUIDs.has(r.relationshipTypeUUID));

  const headerTitle = t('otherRelationships', 'Other Relationships');
  const { results, totalPages, currentPage, goTo } = usePagination(nonFamilyRelationships, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const handleEditRelationship = (relationShipUuid: string) => {
    launchFichaFamiliarWorkspace('relationship-update-form', {
      relationShipUuid,
      patientUuid,
    });
  };

  const headers = [
    {
      header: t('name', 'Name'),
      key: 'name',
    },
    {
      header: t('relationToPatient', 'Relation with Patient'),
      key: 'relation',
    },
    {
      header: t('age', 'Age'),
      key: 'age',
    },
    {
      header: t('alive', 'Alive'),
      key: 'alive',
    },
    {
      header: t('causeOfDeath', 'Cause of Death'),
      key: 'causeOfDeath',
    },
    {
      header: t('chronicDisease', 'Chronic Disease'),
      key: 'chronicDisease',
    },
    { header: t('actions', 'Actions'), key: 'actions' },
  ];

  const handleAddHistory = () => {
    launchFichaFamiliarWorkspace('other-relationship-form', {
      workspaceTitle: 'Other Relationship Form',
      patientUuid,
    });
  };

  const tableRows =
    results?.map((relation) => {
      const patientUuid = relation.patientUuid;

      return {
        id: `${relation.uuid}`,
        name: (
          <ConfigurableLink
            style={{ textDecoration: 'none' }}
            to={globalThis.getOpenmrsSpaBase() + `patient/${relation.relativeUuid}/chart/Patient Summary`}
          >
            {relation.name}
          </ConfigurableLink>
        ),
        relation: relation?.relationshipType,
        age: relation?.relativeAge ?? '--',
        alive: relation?.dead ? t('dead', 'Dead') : t('alive', 'Alive'),
        causeOfDeath: (
          <ConceptObservations patientUuid={patientUuid} conceptUuid={concepts.probableCauseOfDeathConceptUuid} />
        ),
        patientUuid: relation,
        chronicDisease: <ConceptObservations patientUuid={patientUuid} conceptUuid={concepts.problemListConceptUuid} />,
        actions: (
          <>
            <Button
              renderIcon={Edit}
              hasIconOnly
              kind="ghost"
              iconDescription="Edit"
              onClick={() => handleEditRelationship(relation.uuid)}
            />
            <Button
              renderIcon={TrashCan}
              hasIconOnly
              kind="ghost"
              iconDescription="Delete"
              onClick={() => deleteRelationship(relation.uuid)}
            />
          </>
        ),
      };
    }) ?? [];

  if (isLoading || isValidating) {
    return (
      <DataTableSkeleton
        headers={headers}
        aria-label="patient bills table"
        showToolbar={false}
        showHeader={false}
        rowCount={3}
        zebra
        columnCount={3}
        className={styles.dataTableSkeleton}
      />
    );
  }

  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }

  if (nonFamilyRelationships.length === 0) {
    return (
      <div className={styles.widgetCard}>
        <Tile className={styles.tile}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{headerTitle}</h4>
          </div>
          <EmptyDataIllustration />
          <p className={styles.content}>There is no other relationships data to display for this patient.</p>
          <Button onClick={handleAddHistory} renderIcon={Add} kind="ghost">
            {t('addRelationship', 'Add relationship')}
          </Button>
        </Tile>
      </div>
    );
  }

  return (
    <div className={styles.widgetContainer}>
      <CardHeader title={headerTitle}>
        <Button onClick={handleAddHistory} renderIcon={Add} kind="ghost">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable
        useZebraStyles
        size="sm"
        rows={tableRows ?? []}
        headers={headers}
        render={({ rows, headers, getHeaderProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      key={header.key}
                      {...getHeaderProps({
                        header,
                        isSortable: header.isSortable,
                      })}
                    >
                      {renderHeaderLabel(header.header)}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      />
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        pageSizes={pageSizes}
        totalItems={nonFamilyRelationships.length}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
        backwardText={t('previousPage', 'Página anterior')}
        forwardText={t('nextPage', 'Página siguiente')}
        itemRangeText={(min, max, total) =>
          t('itemRangeText', '{{min}}-{{max}} de {{total}} elementos', { min, max, total })
        }
        itemsPerPageText={t('itemsPerPage', 'Elementos por página:')}
        pageNumberText={t('pageNumber', 'Página')}
        pageRangeText={(_, total) => t('paginationPageText', 'de {{count}} páginas', { count: total })}
      />
    </div>
  );
};
