import type { FormRendererProps } from '@openmrs/esm-patient-common-lib';

import type { Form } from '../types';

type EncounterDraft = Parameters<NonNullable<FormRendererProps['handleEncounterCreate']>>[0];
type EncounterObs = NonNullable<EncounterDraft['obs']>[number];

export interface CREDControlIdentity {
  controlNumber?: number;
  controlNumberConceptUuid?: string;
}

type CREDFormPostResponse = (encounter?: { uuid?: string }) => void;

function isValidControlIdentity(
  controlNumber: number | undefined,
  controlNumberConceptUuid: string | undefined,
): controlNumber is number {
  return (
    Number.isInteger(controlNumber) &&
    Number(controlNumber) >= 1 &&
    Number(controlNumber) <= 27 &&
    Boolean(controlNumberConceptUuid?.trim())
  );
}

function getConceptUuid(concept: NonNullable<EncounterDraft['obs']>[number]['concept']): string | undefined {
  return typeof concept === 'string' ? concept : concept?.uuid;
}

export function addCREDControlNumberToEncounter(
  encounter: EncounterDraft,
  { controlNumber, controlNumberConceptUuid }: CREDControlIdentity,
): EncounterDraft {
  if (!isValidControlIdentity(controlNumber, controlNumberConceptUuid)) return encounter;

  const conceptUuid = controlNumberConceptUuid.trim();
  const existingObs = encounter.obs ?? [];
  const hasControlNumberObs = existingObs.some((obs) => getConceptUuid(obs.concept) === conceptUuid);
  const obs = hasControlNumberObs
    ? existingObs.map((observation) =>
        getConceptUuid(observation.concept) === conceptUuid ? { ...observation, value: controlNumber } : observation,
      )
    : [...existingObs, { concept: conceptUuid, value: controlNumber } as EncounterObs];

  return { ...encounter, obs };
}

export function buildCREDFormWorkspaceProps(
  form: Form,
  encounterUuid: string,
  consultationDatetime: string | undefined,
  onFormSubmitted: CREDFormPostResponse,
  controlIdentity: CREDControlIdentity = {},
) {
  const shouldPersistControlNumber = isValidControlIdentity(
    controlIdentity.controlNumber,
    controlIdentity.controlNumberConceptUuid,
  );

  return {
    form,
    encounterUuid,
    handlePostResponse: onFormSubmitted,
    preFilledQuestions: consultationDatetime ? { encounterDatetime: new Date(consultationDatetime) } : undefined,
    ...(shouldPersistControlNumber && {
      handleEncounterCreate: (encounter: EncounterDraft) => addCREDControlNumberToEncounter(encounter, controlIdentity),
    }),
  };
}

export function buildNewCREDFormWorkspaceProps(
  form: Form,
  consultationDatetime: string | undefined,
  onFormSubmitted: CREDFormPostResponse,
  controlIdentity: CREDControlIdentity = {},
) {
  return buildCREDFormWorkspaceProps(form, '', consultationDatetime, onFormSubmitted, controlIdentity);
}
