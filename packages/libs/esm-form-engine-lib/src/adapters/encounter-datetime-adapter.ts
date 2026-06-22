import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { formatDate } from '@openmrs/esm-utils';
import { type FormContextProps } from '../provider/form-provider';
import {
  type FormField,
  type FormFieldValueAdapter,
  type FormProcessorContextProps,
  type ValueAndDisplay,
} from '../types';
import { gracefullySetSubmission, isDateValue } from '../utils/common-utils';

export const EncounterDatetimeAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, _context: FormContextProps): unknown {
    return gracefullySetSubmission(field, isDateValue(value) ? value : undefined, undefined);
  },
  getInitialValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): Date {
    const encounterDatetime = getEncounterDatetime(sourceObject);
    return encounterDatetime ? new Date(encounterDatetime) : context.sessionDate;
  },
  getPreviousValue: function (
    field: FormField,
    sourceObject: OpenmrsResource,
    _context: FormProcessorContextProps,
  ): ValueAndDisplay {
    const encounterDatetime = getEncounterDatetime(sourceObject);
    if (encounterDatetime) {
      const date = new Date(encounterDatetime);
      return {
        value: date,
        display: getDisplayValue(field, date),
      };
    }
    return null;
  },
  getDisplayValue: function (_field: FormField, value: unknown): string {
    return isDateValue(value) ? formatDate(value) : '';
  },
  tearDown: function (): void {
    return;
  },
};

function getEncounterDatetime(sourceObject: OpenmrsResource): string | Date | null {
  if (!sourceObject || typeof sourceObject !== 'object' || !('encounterDatetime' in sourceObject)) {
    return null;
  }

  const encounterDatetime = (sourceObject as OpenmrsResource & { encounterDatetime?: string | Date }).encounterDatetime;
  return typeof encounterDatetime === 'string' || isDateValue(encounterDatetime) ? encounterDatetime : null;
}

function getDisplayValue(_field: FormField, value: unknown): string {
  return isDateValue(value) ? formatDate(value) : '';
}
