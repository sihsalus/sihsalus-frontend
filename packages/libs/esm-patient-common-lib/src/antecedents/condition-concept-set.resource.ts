import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { CodedCondition } from './conditions.types';

export interface ConditionConceptSetMember {
  uuid: string;
  display?: string;
  names: Array<string>;
  retired?: boolean;
}

export interface ConditionConceptSet {
  uuid: string;
  display?: string;
  retired: boolean;
  setMembers: Array<ConditionConceptSetMember>;
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;
const representation = 'custom:(uuid,display,retired,set,setMembers:(uuid,display,retired,name:(name,display)))';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const label = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

function normalizeConceptSet(value: unknown, expectedUuid: string): ConditionConceptSet {
  if (
    !isRecord(value) ||
    value.uuid !== expectedUuid ||
    value.set !== true ||
    typeof value.retired !== 'boolean' ||
    !Array.isArray(value.setMembers)
  ) {
    throw new Error('The configured condition concept set is unavailable or invalid.');
  }

  const members = new Map<string, ConditionConceptSetMember>();
  for (const member of value.setMembers) {
    if (
      !isRecord(member) ||
      typeof member.uuid !== 'string' ||
      !identifierPattern.test(member.uuid) ||
      (member.retired !== undefined && typeof member.retired !== 'boolean')
    ) {
      throw new Error('The condition concept set contains invalid members.');
    }
    const name = isRecord(member.name) ? member.name : undefined;
    const names = [
      ...new Set(
        [label(member.display), label(name?.display), label(name?.name)].filter(
          (value): value is string => value !== undefined,
        ),
      ),
    ];
    const previous = members.get(member.uuid);
    const retired = typeof member.retired === 'boolean' ? member.retired : undefined;
    members.set(member.uuid, {
      uuid: member.uuid,
      display: previous?.display ?? names[0],
      names: [...new Set([...(previous?.names ?? []), ...names])],
      // Unknown or conflicting retirement metadata cannot authorize a new selection.
      retired: previous ? previous.retired !== false || retired !== false : retired,
    });
  }
  return {
    uuid: expectedUuid,
    display: label(value.display),
    retired: value.retired,
    setMembers: [...members.values()],
  };
}

export function useConditionConceptSet(conceptSetUuid: string) {
  const configured = typeof conceptSetUuid === 'string' && identifierPattern.test(conceptSetUuid);
  const configurationError = useMemo(
    () => (configured ? undefined : new Error('A condition concept set must be configured.')),
    [configured],
  );
  const { data, error, isLoading } = useSWR<ConditionConceptSet, Error>(
    configured ? `${restBaseUrl}/concept/${encodeURIComponent(conceptSetUuid)}?v=${representation}` : null,
    async (url: string) =>
      normalizeConceptSet((await openmrsFetch<unknown>(url, { rejectOnAuthFailure: true })).data, conceptSetUuid),
    { shouldRetryOnError: false },
  );
  return {
    conceptSet: error || configurationError || data?.uuid !== conceptSetUuid ? null : data,
    error: error ?? configurationError,
    isLoading: configured && isLoading,
  };
}

export function useConditionsSearchFromConceptSet(conditionToLookup: string, conceptSetUuid: string) {
  const { conceptSet, error, isLoading } = useConditionConceptSet(conceptSetUuid);
  const retiredError = useMemo(
    () => (conceptSet?.retired ? new Error('The configured condition concept set has been retired.') : undefined),
    [conceptSet?.retired],
  );
  const searchResults = useMemo<Array<CodedCondition>>(() => {
    const term = conditionToLookup.trim().toLowerCase();
    if (!term || !conceptSet || error || retiredError) {
      return [];
    }
    return conceptSet.setMembers.flatMap((member) =>
      member.retired === false &&
      member.display &&
      (member.uuid.toLowerCase().includes(term) || member.names.some((name) => name.toLowerCase().includes(term)))
        ? [{ uuid: member.uuid, display: member.display }]
        : [],
    );
  }, [conditionToLookup, conceptSet, error, retiredError]);

  return { searchResults, conceptSet, error: error ?? retiredError, isSearching: isLoading };
}
