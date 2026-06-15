import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
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
} from '@carbon/react';
import {
  AddIcon,
  formatDate,
  isDesktop,
  launchWorkspace2,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilteredEncounter } from '../../hooks/useFilteredEncounter';
import { formEntryWorkspace } from '../../types';

import ObservationGroupDetails, { type ObservationGroup } from './observation-group-details.component';
import styles from './patient-observation-group-table.scss';

// Importar tipos desde el componente separado

interface PatientObservationGroupTableProps {
  patientUuid: string;
  headerTitle: string;
  displayText: string;
  encounterType: string;
  formUuid: string;
  formWorkspace?: string;
  editPrivilege?: string | string[];
}

interface ObservationGroupTableRowData {
  id: string;
  title: JSX.Element;
  date: JSX.Element;
  actions: JSX.Element;
}

// Componente para mostrar el título del grupo
const GroupTitleCell: React.FC<{ group: ObservationGroup }> = ({ group }) => (
  <div>
    <div style={{ fontWeight: 'bold' }}>{group.title}</div>
    <div style={{ fontSize: '0.875rem', color: '#6f6f6f' }}>
      {group.count} item{group.count !== 1 ? 's' : ''}
    </div>
  </div>
);

// Componente para mostrar la fecha
const GroupDateCell: React.FC<{ group: ObservationGroup }> = ({ group }) => <div>{group.date}</div>;

// Componente para acciones (si necesitas agregar alguna)
const GroupActionsCell: React.FC<{ group: ObservationGroup }> = () => (
  <div>{/* Aquí puedes agregar acciones específicas por grupo si es necesario */}</div>
);

// Sub-tabla para mostrar los group members - ahora importada
// const ObservationGroupDetails se importa desde archivo separado

const PatientObservationGroupTable: React.FC<PatientObservationGroupTableProps> = ({
  patientUuid,
  headerTitle,
  displayText,
  encounterType,
  formUuid,
  formWorkspace,
  editPrivilege,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const desktopLayout = isDesktop(layout);
  const session = useSession();
  const canEdit = userHasAccess(editPrivilege, session?.user);
  const canLaunchForm = Boolean(formWorkspace && (!editPrivilege || canEdit));

  const {
    prenatalEncounter: data,
    isLoading,
    error,
    mutate,
  } = useFilteredEncounter(patientUuid, encounterType, formUuid);
  //TODO: MODIFY THIS TO SEND THE CURRENT DATA TO THE WORKSPACE , IT SHOULD BE EDITABLE
  const launchForm = useCallback(() => {
    try {
      if (canLaunchForm && formWorkspace) {
        launchWorkspace2(formEntryWorkspace, {
          form: { uuid: formWorkspace },
          encounterUuid: '',
        });
      }
      if (mutate) {
        setTimeout(() => mutate(), 1000);
      }
    } catch (err) {
      console.error('Failed to launch form:', err);
    }
  }, [canLaunchForm, formWorkspace, mutate]);

  const parseDisplay = useCallback((display: string) => {
    const [category, ...rest] = display.split(': ');
    return {
      category,
      value: rest.join(': ') || '',
    };
  }, []);

  // Transformar datos para la tabla expandible
  const observationGroups = useMemo((): ObservationGroup[] => {
    if (!data?.obs) return [];

    return data.obs
      .filter((obs) => Array.isArray(obs.groupMembers) && obs.groupMembers.length > 0)
      .map((obs, index) => {
        const { category: title } = parseDisplay(obs.display);
        const rows = obs.groupMembers!.map((member, idx) => {
          const { category, value } = parseDisplay(member.display);
          return {
            id: `row-${member.uuid || idx}`,
            category: { content: category },
            value: { content: value },
          };
        });

        return {
          id: obs.uuid || `group-${index}`,
          title,
          date: data.encounterDatetime ? formatDate(new Date(data.encounterDatetime)) : '',
          count: rows.length,
          rows,
          encounterUuid: data.uuid,
        };
      });
  }, [data, parseDisplay]);

  // Configuración de columnas para la tabla principal
  const columns = [
    { key: 'title', header: t('observationGroup', 'Grupo de Observación'), CellComponent: GroupTitleCell },
    { key: 'date', header: t('date', 'Date'), CellComponent: GroupDateCell },
    { key: 'actions', header: '', CellComponent: GroupActionsCell },
  ];

  // Preparar datos para la tabla
  const rowData: ObservationGroupTableRowData[] = observationGroups?.map((group) => {
    const row: ObservationGroupTableRowData = {
      id: group.id,
      title: <></>,
      date: <></>,
      actions: <></>,
    };

    for (const { key, CellComponent } of columns) {
      row[key as keyof Omit<ObservationGroupTableRowData, 'id'>] = <CellComponent key={key} group={group} />;
    }
    return row;
  });

  // Estados de carga y error
  if (isLoading && (!data?.obs || data.obs.length === 0)) {
    return <DataTableSkeleton role="progressbar" size={desktopLayout ? 'sm' : 'lg'} zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!isLoading && observationGroups.length === 0) {
    return (
      <EmptyState
        headerTitle={headerTitle}
        displayText={displayText}
        launchForm={canLaunchForm ? launchForm : undefined}
      />
    );
  }

  return (
    <div className={styles.widgetCard} role="region" aria-label={headerTitle}>
      <CardHeader title={headerTitle}>
        {isLoading && <InlineLoading description={t('refreshing', 'Refreshing...')} status="active" />}
        {canLaunchForm && (
          <Button
            kind="ghost"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            onClick={launchForm}
            aria-label={t('add', 'Add')}
          >
            {t('edit', 'Edit')}
          </Button>
        )}
      </CardHeader>

      <DataTable headers={columns} rows={rowData} size={desktopLayout ? 'sm' : 'lg'} useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getExpandHeaderProps, getRowProps, getExpandedRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                  {headers.map((header) => (
                    <TableHeader
                      key={header.key}
                      {...getHeaderProps({
                        header,
                        className: header.key === 'actions' ? styles.actionsColumn : '',
                      })}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  const group = observationGroups[i];
                  return (
                    <React.Fragment key={row.id}>
                      <TableExpandRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell?.value}</TableCell>
                        ))}
                      </TableExpandRow>
                      {row.isExpanded ? (
                        <TableExpandedRow {...getExpandedRowProps({ row })} colSpan={headers.length + 1}>
                          <ObservationGroupDetails group={group} />
                        </TableExpandedRow>
                      ) : (
                        <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 1} />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default React.memo(PatientObservationGroupTable);
