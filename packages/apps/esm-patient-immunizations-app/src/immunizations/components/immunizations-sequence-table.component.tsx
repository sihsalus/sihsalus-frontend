/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  DataTable,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  EditIcon,
  formatDate,
  getCoreTranslation,
  showModal,
  TrashCanIcon,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { immunizationEditPrivilege } from '../../constants';
import { type ImmunizationGrouped } from '../../types';
import { immunizationFormSub } from '../utils';
import styles from './immunizations-sequence-table.scss';

interface SequenceTableProps {
  immunizationsByVaccine: ImmunizationGrouped;
  launchPatientImmunizationForm: () => void;
  patientUuid: string;
}

interface DeleteImmunizationParams {
  doseNumber: number;
  immunizationId: string;
  persistenceSource?: 'fhir' | 'ampath-form';
  vaccineUuid: string;
}

const SequenceTable: React.FC<SequenceTableProps> = ({
  immunizationsByVaccine,
  launchPatientImmunizationForm,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(immunizationEditPrivilege, session?.user);
  const { existingDoses, sequences, vaccineUuid } = immunizationsByVaccine;
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'md' : 'sm';

  const tableHeaders = useMemo(
    () => [
      {
        key: 'sequence',
        header: sequences.length ? t('sequence', 'Sequence') : t('doseNumberWithinSeries', 'Dose number within series'),
      },
      {
        key: 'status',
        header: t('immunizationStatus', 'Estado de aplicación'),
      },
      {
        key: 'vaccinationDate',
        header: t('vaccinationDate', 'Vaccination date'),
      },
      { key: 'nextDoseDate', header: t('nextDoseDate', 'Next dose date') },
      { key: 'expirationDate', header: t('expirationDate', 'Expiration date') },
      { key: 'note', header: t('note', 'Note') },
      { key: 'actions', header: t('actions', 'Actions') },
    ],
    [t, sequences.length],
  );

  const handleDeleteImmunization = ({
    doseNumber,
    immunizationId,
    persistenceSource,
    vaccineUuid,
  }: DeleteImmunizationParams) => {
    const dispose = showModal('vacunacion-delete-confirmation-modal', {
      doseNumber,
      immunizationId,
      persistenceSource,
      patientUuid,
      vaccineUuid,
      close: () => dispose?.(),
    });
  };

  const tableRows = existingDoses?.map((dose) => ({
    id: dose?.immunizationObsUuid,
    sequence: !sequences.length
      ? dose.doseNumber || 0
      : sequences?.find((s) => s.sequenceNumber === dose.doseNumber)?.sequenceLabel || dose.doseNumber,
    status:
      dose.status === 'not-done'
        ? `${t('notAdministered', 'No aplicada / diferida')}${dose.statusReason ? `: ${dose.statusReason}` : ''}`
        : t('administered', 'Aplicada'),
    vaccinationDate:
      dose?.occurrenceDateTime &&
      formatDate(new Date(dose.occurrenceDateTime), {
        mode: 'standard',
        noToday: true,
        time: false,
      }),
    nextDoseDate: dose?.nextDoseDate
      ? formatDate(new Date(dose.nextDoseDate), {
          mode: 'standard',
          noToday: true,
          time: false,
        })
      : '--',
    expirationDate:
      (dose?.expirationDate &&
        formatDate(new Date(dose.expirationDate), {
          mode: 'standard',
          noToday: true,
          time: false,
        })) ||
      '--',
    note: dose?.note?.[0]?.text || '--',
    actions: canEdit ? (
      <div className={styles.actionButtons}>
        <IconButton
          kind="ghost"
          label={getCoreTranslation('edit')}
          onClick={() => {
            immunizationFormSub.next({
              vaccineUuid: vaccineUuid,
              immunizationId: dose.immunizationObsUuid,
              persistenceSource: dose.persistenceSource,
              vaccinationDate: dose.occurrenceDateTime,
              doseNumber: dose.doseNumber,
              status: dose.status,
              statusReason: dose.statusReason,
              programContext: dose.programContext,
              nextDoseDate: dose.nextDoseDate,
              note: dose.note?.[0]?.text,
              expirationDate: dose.expirationDate,
              lotNumber: dose.lotNumber,
              manufacturer: dose.manufacturer,
              visitId: dose.visitUuid,
              locationId: dose.locationUuid,
            });
            launchPatientImmunizationForm();
          }}
          size={responsiveSize}
        >
          <EditIcon size={16} />
        </IconButton>
        <IconButton
          kind="ghost"
          label={getCoreTranslation('delete')}
          onClick={() =>
            handleDeleteImmunization({
              doseNumber: dose.doseNumber,
              immunizationId: dose.immunizationObsUuid,
              persistenceSource: dose.persistenceSource,
              vaccineUuid,
            })
          }
          size={responsiveSize}
        >
          <TrashCanIcon size={16} />
        </IconButton>
      </div>
    ) : null,
  }));

  if (tableRows?.length) {
    return (
      <DataTable rows={tableRows} headers={tableHeaders} useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer className={styles.sequenceTable}>
            <Table aria-label="immunization dose sequence" {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
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
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });

                  return (
                    <TableRow key={key} {...rowProps}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell?.id} className={styles.tableCell}>
                          {cell?.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    );
  }
};

export default SequenceTable;
