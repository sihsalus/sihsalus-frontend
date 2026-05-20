import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ErrorState, formatDate, openmrsFetch, showModal, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { CardHeader, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import type { Encounter } from '@sihsalus/esm-sihsalus-shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import type { OdontogramConfig } from '../config-schema';
import { patientFormEntryWorkspace } from '../constants';
import DentalEmptyState from '../ui/dental-empty-state.component';
import { deleteEncounter, type EncountersResponse, getDentalAttentionUrl } from './odontologia-attention.resource';

type OdontologiaAttentionDashboardProps = {
  patientUuid: string;
  embedded?: boolean;
};

function getProviderName(encounter: Encounter) {
  return encounter.encounterProviders?.[0]?.provider?.person?.display ?? '--';
}

function getVisitType(encounter: Encounter) {
  return encounter.visit?.visitType?.display ?? '--';
}

const OdontologiaAttentionDashboard: React.FC<OdontologiaAttentionDashboardProps> = ({
  patientUuid,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const { dentalEncounterTypeUuid, dentalFormUuid } = useConfig<OdontogramConfig>();

  const url =
    patientUuid && dentalEncounterTypeUuid && dentalFormUuid
      ? getDentalAttentionUrl(patientUuid, dentalEncounterTypeUuid, dentalFormUuid)
      : null;

  const { data, isLoading, error, mutate } = useSWR<{ data: EncountersResponse }>(url, openmrsFetch, {
    revalidateOnFocus: false,
  });

  const encounters = useMemo(
    () =>
      (data?.data?.results ?? []).filter(
        (encounter) =>
          encounter.encounterType?.uuid === dentalEncounterTypeUuid && encounter.form?.uuid === dentalFormUuid,
      ),
    [data, dentalEncounterTypeUuid, dentalFormUuid],
  );

  const launchDentalForm = (encounterUuid = '') => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: t('dentalAttention', 'Atención odontológica'),
      mutateForm: mutate,
      formInfo: {
        patientUuid,
        encounterUuid,
        formUuid: dentalFormUuid,
        additionalProps: {},
      },
    });
  };

  const handleDelete = (encounterUuid: string) => {
    const close = showModal('delete-encounter-modal', {
      close: () => close(),
      encounterTypeName: t('dentalAttention', 'Atención odontológica'),
      onConfirmation: () => {
        const abortController = new AbortController();
        deleteEncounter(encounterUuid, abortController)
          .then(() => {
            mutate();
            showSnackbar({
              isLowContrast: true,
              title: t('encounterDeleted', 'Encounter deleted'),
              subtitle: t('dentalAttentionDeleted', 'La atención odontológica fue eliminada.'),
              kind: 'success',
            });
          })
          .catch(() => {
            showSnackbar({
              isLowContrast: false,
              title: t('error', 'Error'),
              subtitle: t('dentalAttentionDeleteError', 'No se pudo eliminar la atención odontológica.'),
              kind: 'error',
            });
          });
        close();
      },
    });
  };

  if (!dentalEncounterTypeUuid || !dentalFormUuid) {
    return (
      <ErrorState
        error={new Error(t('dentalConfigMissing', 'Falta configurar odontología.'))}
        headerTitle={t('dentalAttention', 'Atención odontológica')}
      />
    );
  }

  if (isLoading) {
    return <DataTableSkeleton rowCount={5} headers={[]} aria-label={t('dentalAttention', 'Atención odontológica')} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={t('dentalAttention', 'Atención odontológica')} />;
  }

  if (encounters.length === 0) {
    return (
      <DentalEmptyState
        title={t('dentalAttention', 'Atención odontológica')}
        description={t(
          'dentalAttentionEmptyDescription',
          'No hay registros de atención odontológica para mostrar para este paciente.',
        )}
        actionLabel={t('registerDentalAttention', 'Registrar atención odontológica')}
        onAction={() => launchDentalForm()}
      />
    );
  }

  return (
    <div>
      {embedded ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1rem 0.5rem' }}>
          <Button kind="ghost" onClick={() => launchDentalForm()}>
            {t('add', 'Add')}
          </Button>
        </div>
      ) : (
        <CardHeader title={t('dentalAttention', 'Atención odontológica')}>
          <Button kind="ghost" onClick={() => launchDentalForm()}>
            {t('add', 'Add')}
          </Button>
        </CardHeader>
      )}
      <TableContainer>
        <Table size="sm" useZebraStyles aria-label={t('dentalAttention', 'Atención odontológica')}>
          <TableHead>
            <TableRow>
              <TableHeader>{t('dateTime', 'Fecha y hora')}</TableHeader>
              <TableHeader>{t('visitType', 'Tipo de visita')}</TableHeader>
              <TableHeader>{t('provider', 'Proveedor')}</TableHeader>
              <TableHeader>{t('actions', 'Acciones')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {encounters.map((encounter) => (
              <TableRow key={encounter.uuid}>
                <TableCell>{formatDate(new Date(encounter.encounterDatetime), { mode: 'wide', time: true })}</TableCell>
                <TableCell>{getVisitType(encounter)}</TableCell>
                <TableCell>{getProviderName(encounter)}</TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button size="sm" kind="primary" onClick={() => launchDentalForm(encounter.uuid)}>
                      {t('edit', 'Edit')}
                    </Button>
                    <Button size="sm" kind="danger--tertiary" onClick={() => handleDelete(encounter.uuid)}>
                      {t('delete', 'Delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default OdontologiaAttentionDashboard;
