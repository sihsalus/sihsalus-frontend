import { validate as validateUuid } from 'uuid';

import type { Encounter, EncounterCreate } from '../types';

/**
 * Mutates the given encounterCreate value to the format of an Encounter,
 * i.e. the format that the REST API returns when GETting the same encounter.
 *
 * This is required because:
 * 1) Other modules display encounter data based on the GET format.
 *    When they read out sync items, they will require that format (not the POST format).
 * 2) The form engine, when editing an offline encounter from the sync item, also expects the GET format.
 */
export function mutateEncounterCreateToPartialEncounter(encounterCreate: EncounterCreate): Partial<Encounter> {
  recursivelyMutateAllUuidLikeStrings(encounterCreate);

  // Some known properties are problematic and not caught by the automatic object walking above.
  // Examples: `concept` attributes of observations which can have non-UUID values
  // like "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".
  for (const path of ['obs.concept']) {
    mutateUuidStringToObjectAtPath(encounterCreate, path);
  }

  return encounterCreate as unknown as Encounter;
}

/**
 * Walks the given value and transforms all pure strings which are UUIDs
 * into the special UUID object syntax: "uuid-string" -> { uuid: "uuid-string" }.
 */
function recursivelyMutateAllUuidLikeStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const inner of value) {
      recursivelyMutateAllUuidLikeStrings(inner);
    }
  } else if (isRecord(value)) {
    for (const [propKey, propValue] of Object.entries(value)) {
      if (propKey !== 'uuid' && typeof propValue === 'string' && validateUuid(propValue)) {
        mutateUuidStringToObject(value, propKey);
      } else if (typeof propValue === 'object') {
        recursivelyMutateAllUuidLikeStrings(propValue);
      }
    }
  }

  return value;
}

function mutateUuidStringToObjectAtPath(value: unknown, path: string) {
  if (!isRecord(value)) {
    return;
  }

  const [currentPathSegment, ...remainingPathSegments] = path.split('.');

  if (remainingPathSegments.length === 0) {
    mutateUuidStringToObject(value, currentPathSegment);
    return;
  }

  const nextValue = value?.[currentPathSegment];
  if (Array.isArray(nextValue)) {
    for (const v of nextValue) {
      mutateUuidStringToObjectAtPath(v, remainingPathSegments.join('.'));
    }
  } else if (typeof nextValue === 'object') {
    mutateUuidStringToObjectAtPath(nextValue, remainingPathSegments.join('.'));
  }
}

function mutateUuidStringToObject(value: Record<string, unknown>, keyToTransform: string) {
  const currentValue = value[keyToTransform];

  if (typeof currentValue === 'string') {
    value[keyToTransform] = { uuid: currentValue };
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
