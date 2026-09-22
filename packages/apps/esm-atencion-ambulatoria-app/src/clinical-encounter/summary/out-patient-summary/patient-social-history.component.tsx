import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@carbon/react';
import { Edit } from '@carbon/react/icons';
import { formatDate, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { getObsFromEncounter } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';
import { configSchema, type ConfigObject } from '../../../config-schema';
import ClinicalHistoryCard from '../../../consulta-externa/clinical-history-card.component';
import { useSocialHistory, type SocialHistoryEncounter } from '../../../hooks/useSocialHistory';
import { useSocialHistoryFormLauncher } from '../../../hooks/useSocialHistoryFormLauncher';
import type { OpenmrsEncounter } from '../../../types';
import { socialHistoryEditPrivilege } from '../../../utils/constants';
import styles from './patient-history.scss';

interface OutPatientSocialHistoryProps {
  patientUuid: string;
  encounters: OpenmrsEncounter[];
  isLoading: boolean;
  error: Error;
  isValidating: boolean;
  mutate: KeyedMutator<{ data: { results: OpenmrsEncounter[] } }>;
}

interface HistoryRow {
  id: string;
  cells: React.ReactNode[];
}

/** Carbon table shared by current and historical records, with the same responsive sizing as other modules. */
function HistoryTable({
  title,
  headers,
  rows,
  onEdit,
}: {
  title: string;
  headers: string[];
  rows: HistoryRow[];
  onEdit?: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const size = useLayoutType() === 'tablet' ? 'lg' : 'sm';
  return (
    <TableContainer className={styles.historyTable}>
      <Table aria-label={title} size={size} useZebraStyles>
        <TableHead>
          <TableRow>
            {headers.map((header) => (
              <TableHeader key={header}>{header}</TableHeader>
            ))}
            {onEdit ? (
              <RequirePrivilege privilege={socialHistoryEditPrivilege} hideUnauthorized>
                <TableHeader>{t('actions', 'Actions')}</TableHeader>
              </RequirePrivilege>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((value, index) => (
                <TableCell key={headers[index]}>{value}</TableCell>
              ))}
              {onEdit ? (
                <RequirePrivilege privilege={socialHistoryEditPrivilege} hideUnauthorized>
                  <TableCell>
                    <Button kind="ghost" size={size} renderIcon={Edit} onClick={() => onEdit(row.id)}>
                      {t('edit', 'Edit')}
                    </Button>
                  </TableCell>
                </RequirePrivilege>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function formatEncounterDate(value: string) {
  return Number.isFinite(new Date(value).getTime()) ? formatDate(new Date(value), { time: true }) : '--';
}

function socialValue(
  encounter: SocialHistoryEncounter,
  concept: string,
  yes: string,
  no: string,
  t: (key: string, fallback: string) => string,
) {
  const value = encounter.obs?.find((obs) => obs.concept.uuid === concept)?.value;
  if (value == null || value === '') return '--';
  if (typeof value !== 'object') return value;
  if (value.uuid === yes) return t('yes', 'Yes');
  if (value.uuid === no) return t('no', 'No');
  return value.display || '--';
}

const OutPatientSocialHistory: React.FC<OutPatientSocialHistoryProps> = (legacy) => {
  const { t } = useTranslation();
  const { concepts, socialHistory } = useConfig<ConfigObject>();
  const history = useSocialHistory(legacy.patientUuid);
  const openForm = useSocialHistoryFormLauncher(legacy.patientUuid, () =>
    Promise.all([history.mutate(), legacy.mutate()]),
  );
  const title = t('socialHistory', 'Social History');
  const previousTitle = t('previousSocialHistory', 'Previous social history records');
  const loadError = t('socialHistoryLoadError', 'Social history could not be loaded. Reload and try again.');
  const headers = [
    t('encounterDate', 'Date'),
    t('alcoholUse', 'Alcohol Use'),
    t('tobaccoUse', 'Tobacco use'),
    t('dailyCigaretteUse', 'Cigarettes per day'),
    t('smokingDurationYears', 'Smoking duration (years)'),
  ];
  const fields = socialHistory.concepts;
  const rows = history.data.map((encounter) => ({
    id: encounter.uuid,
    cells: [
      formatEncounterDate(encounter.encounterDatetime),
      ...[fields.alcohol, fields.tobacco, fields.cigarettesPerDay, fields.smokingDurationYears].map((concept) =>
        socialValue(encounter, concept, fields.yes, fields.no, t),
      ),
    ],
  }));
  const legacyHeaders = [
    t('encounterDate', 'Date'),
    t('alcoholUse', 'Alcohol Use'),
    concepts.alcoholUseDurationUuid === configSchema.concepts.alcoholUseDurationUuid._default
      ? t('dailyCigaretteUse', 'Cigarettes per day')
      : t('alcoholUseDuration', 'Alcohol Use Duration'),
    t('smoking', 'Smoking'),
    concepts.smokingDurationUuid === configSchema.concepts.smokingDurationUuid._default
      ? t('smokingDurationYears', 'Smoking duration (years)')
      : t('smokingDuration', 'Smoking Duration'),
    concepts.otherSubstanceAbuseUuid === configSchema.concepts.otherSubstanceAbuseUuid._default
      ? t('tobaccoUseStatus', 'Tobacco use status')
      : t('otherSubstanceAbuse', 'Other Substance Abuse'),
  ];
  const legacyRows = (legacy.encounters ?? []).flatMap((encounter) => {
    const values = [
      concepts.alcoholUseUuid,
      concepts.alcoholUseDurationUuid,
      concepts.smokingUuid,
      concepts.smokingDurationUuid,
      concepts.otherSubstanceAbuseUuid,
    ].map((concept) => getObsFromEncounter(encounter, concept));
    return values.every((value) => value === '--')
      ? []
      : [{ id: encounter.uuid, cells: [formatEncounterDate(encounter.encounterDatetime), ...values] }];
  });

  return (
    <div className={styles.historyCards}>
      <ClinicalHistoryCard
        title={title}
        emptyDisplayText={title}
        empty={rows.length === 0}
        actionLabel={t('recordSocialHistory', 'Record social history')}
        editPrivilege={socialHistoryEditPrivilege}
        onAction={() => {
          void openForm();
        }}
        isLoading={history.isLoading}
        isValidating={history.isValidating}
        error={history.error || history.truncated ? new Error(loadError) : undefined}
        skeletonHeaders={headers.map((header) => ({ header }))}
        pagination={history.pagination}
      >
        <HistoryTable
          title={title}
          headers={headers}
          rows={rows}
          onEdit={(uuid) => {
            void openForm(uuid);
          }}
        />
      </ClinicalHistoryCard>
      {legacyRows.length || legacy.isLoading || legacy.error ? (
        <ClinicalHistoryCard
          title={previousTitle}
          emptyDisplayText={previousTitle}
          isLoading={legacy.isLoading}
          isValidating={legacy.isValidating}
          error={legacy.error ? new Error(loadError) : undefined}
          skeletonHeaders={legacyHeaders.map((header) => ({ header }))}
        >
          <HistoryTable title={previousTitle} headers={legacyHeaders} rows={legacyRows} />
        </ClinicalHistoryCard>
      ) : null}
    </div>
  );
};
export default OutPatientSocialHistory;
