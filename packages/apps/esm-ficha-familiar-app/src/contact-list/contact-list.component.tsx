import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineNotification,
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
import { Add, Edit, TrashCan } from '@carbon/react/icons';
import {
  ConfigurableLink,
  ErrorState,
  isDesktop,
  launchWorkspace,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyDataIllustration, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import useContacts from '../hooks/useContacts';
import { deleteRelationship } from '../relationships/relationship.resources';

import styles from './contact-list.scss';
import HIVStatus from './hiv-status.component';
import SensitiveDataReveal from './sensitive-data-reveal.component';

interface ContactListProps {
  patientUuid: string;
}

const ContactList: React.FC<ContactListProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const headerTitle = t('contactList', 'Contact list');
  const workspaceTitle = t('sexualContactForm', 'Formulario de Contactos Sexuales');
  const layout = useLayoutType();

  const { contacts, error, isLoading } = useContacts(patientUuid);
  const { results, totalPages, currentPage, goTo } = usePagination(contacts, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const headers = [
    {
      header: t('listingDate', 'Listing date'),
      key: 'startDate',
    },
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
      header: t('sex', 'Sex'),
      key: 'sex',
    },
    {
      header: t('contact', 'Contact'),
      key: 'contact',
    },
    {
      header: t('contactCreated', 'Contact created'),
      key: 'contactCreated',
    },
    {
      header: t('hivStatus', 'HIV Status'),
      key: 'hivStatus',
    },
    {
      header: t('baselineHivStatus', 'Baseline HIV Status'),
      key: 'baseLineivStatus',
    },
    {
      header: t('livingWithClient', 'Living with client'),
      key: 'livingWithClient',
    },
    {
      header: t('pnsAproach', 'PNS Aproach'),
      key: 'pnsAproach',
    },
    {
      header: t('ipvOutcome', 'IPV Outcome'),
      key: 'ipvOutcome',
    },
    {
      header: t('dataConsent', 'Consentimiento Ley 29733'),
      key: 'dataConsent',
    },
    { header: t('actions', 'Actions'), key: 'actions' },
  ];

  const handleAddContact = () => {
    launchWorkspace('contact-list-form', {
      workspaceTitle,
      patientUuid,
    });
  };

  const handleEditRelationship = (relationShipUuid: string) => {
    launchWorkspace('relationship-update-form', {
      relationShipUuid,
      patientUuid,
    });
  };

  const tableRows =
    results?.map((relation) => {
      return {
        id: `${relation.uuid}`,
        startDate: relation.startDate ?? '--',
        name: (
          <ConfigurableLink
            style={{ textDecoration: 'none' }}
            to={globalThis.getOpenmrsSpaBase() + `patient/${relation.relativeUuid}/chart/Patient Summary`}
          >
            {relation.name}
          </ConfigurableLink>
        ),
        contactCreated: relation.personContactCreated ?? 'No',
        relation: relation?.relationshipType,
        age: relation?.relativeAge ?? '--',
        sex: relation.gender,
        alive: relation?.dead ? t('dead', 'Dead') : t('alive', 'Alive'),
        contact: relation.contact ?? '--',
        hivStatus: (
          <SensitiveDataReveal>
            <HIVStatus relativeUuid={relation.relativeUuid} />
          </SensitiveDataReveal>
        ),
        baseLineivStatus: relation.baselineHIVStatus ? (
          <SensitiveDataReveal>{relation.baselineHIVStatus}</SensitiveDataReveal>
        ) : (
          '--'
        ),
        livingWithClient: relation.livingWithClient ?? '--',
        pnsAproach: relation.pnsAproach ?? '--',
        ipvOutcome: relation.ipvOutcome ? <SensitiveDataReveal>{relation.ipvOutcome}</SensitiveDataReveal> : '--',
        dataConsent:
          relation.dataConsent === null ? (
            <Tag type="gray" size="sm">
              {t('consentUnknown', 'No registrado')}
            </Tag>
          ) : relation.dataConsent ? (
            <Tag type="green" size="sm">
              {t('consentGiven', 'Autorizado')}
            </Tag>
          ) : (
            <Tag type="red" size="sm">
              {t('consentDenied', 'No autorizado')}
            </Tag>
          ),
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

  if (isLoading) {
    return <DataTableSkeleton rowCount={5} />;
  }
  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }

  if (contacts.length === 0) {
    return (
      <div className={styles.widgetCard}>
        <Tile className={styles.tile}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{headerTitle}</h4>
          </div>
          <EmptyDataIllustration />
          <p className={styles.content}>
            {t('noContactToDisplay', 'There is no contact data to display for this patient.')}
          </p>
          <Button onClick={handleAddContact} renderIcon={Add} kind="ghost">
            {t('addPNSContact', 'Add PNS Contact')}
          </Button>
        </Tile>
      </div>
    );
  }
  return (
    <div className={styles.widgetContainer}>
      <InlineNotification
        kind="warning"
        lowContrast
        hideCloseButton
        title={t('sensitiveDataWarning', 'Datos sensibles — Ley 29733')}
        subtitle={t(
          'sensitiveDataWarningSubtitle',
          'Esta sección contiene información de salud protegida. El acceso queda registrado. Use los botones Ver para revelar datos individuales.',
        )}
      />
      <CardHeader title={headerTitle}>
        <Button onClick={handleAddContact} renderIcon={Add} kind="ghost">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable
        rows={tableRows ?? []}
        headers={headers}
        render={({ rows, headers, getHeaderProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label={t('contactList', 'Contact list')}>
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
                      {header.header}
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
        totalItems={contacts.length}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
      />
    </div>
  );
};

export default ContactList;
