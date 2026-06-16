import {
  Button,
  DataTable,
  DataTableSkeleton,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  getObsFromEncounter,
  launchPatientWorkspace,
} from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import { patientFormEntryWorkspace } from '../../utils/constants';
import { useMissedFollowUp } from './missed-follow-up.resource';

import styles from './missed-follow-up.scss';

interface MissedFollowUpProps {
  patientUuid: string;
}

const MissedFollowUp: React.FC<MissedFollowUpProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { concepts, formsList } = useConfig<ConfigObject>();
  const headerTitle = t('missedFollowUp', 'Pérdida en el seguimiento');
  const { encounters, isLoading, error, mutate } = useMissedFollowUp(patientUuid);

  const openMissedFollowUpForm = (encounterUuid = '') => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: headerTitle,
      mutateForm: mutate,
      formInfo: {
        encounterUuid,
        formUuid: formsList?.defaulterTracingFormUuid,
        patientUuid,
        visitTypeUuid: '',
        visitUuid: '',
      },
    });
  };

  const tableHeader = [
    {
      key: 'missedAppointmentDate',
      header: t('missedAppointmentDate', 'Fecha de cita perdida'),
    },
    {
      key: 'visitDate',
      header: t('followUpDate', 'Fecha de seguimiento'),
    },
    {
      key: 'tracingType',
      header: t('followUpType', 'Tipo de seguimiento'),
    },
    {
      key: 'tracingNumber',
      header: t('followUpNumber', 'N.º de seguimiento'),
    },
    {
      key: 'contacted',
      header: t('contacted', 'Contactado'),
    },
    {
      key: 'finalOutcome',
      header: t('finalOutcome', 'Resultado final'),
    },
  ];

  const tableRows = encounters.map((encounter) => {
    const missedAppointmentDate = getObsFromEncounter(encounter, concepts.missedAppointmentDateUuid);

    return {
      id: encounter.uuid,
      missedAppointmentDate:
        missedAppointmentDate === '--' || missedAppointmentDate == null
          ? formatDate(parseDate(encounter.encounterDatetime))
          : formatDate(parseDate(String(missedAppointmentDate))),
      visitDate: formatDate(new Date(encounter.encounterDatetime)),
      tracingType: getObsFromEncounter(encounter, concepts.tracingTypeUuid),
      tracingNumber: getObsFromEncounter(encounter, concepts.tracingNumberUuid),
      contacted: getObsFromEncounter(encounter, concepts.contactedUuid),
      finalOutcome: getObsFromEncounter(encounter, concepts.tracingOutcomeUuid),
    };
  });

  if (isLoading) {
    return <DataTableSkeleton headers={tableHeader} aria-label={headerTitle} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (encounters.length === 0) {
    return <EmptyState displayText={headerTitle} headerTitle={headerTitle} launchForm={openMissedFollowUpForm} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Button
          size="md"
          kind="ghost"
          onClick={() => openMissedFollowUpForm()}
          renderIcon={(props) => <Add size={24} {...props} />}
          iconDescription={t('add', 'Add')}
        >
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable
        useZebraStyles
        size="sm"
        rows={tableRows}
        headers={tableHeader}
        render={({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table size="sm" {...getTableProps()} aria-label={headerTitle}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader aria-label={t('actions', 'Actions')} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className="cds--table-column-menu">
                      <OverflowMenu aria-label={t('actions', 'Actions')} flipped={false}>
                        <OverflowMenuItem
                          onClick={() => openMissedFollowUpForm(encounters[index]?.uuid)}
                          itemText={t('edit', 'Edit')}
                        />
                      </OverflowMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      />
    </div>
  );
};

export default MissedFollowUp;
