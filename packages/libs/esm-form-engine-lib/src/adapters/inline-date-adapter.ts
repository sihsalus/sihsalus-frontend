import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { formatDate, parseDate, toOmrsIsoString } from '@openmrs/esm-utils';
import { type FormContextProps } from '../provider/form-provider';
import { type FormField, type FormFieldValueAdapter, type FormProcessorContextProps } from '../types';
import { hasSubmission, isDateValue, isFormFieldSubmissionValue, isStringValue } from '../utils/common-utils';
import { isEmpty } from '../validators/form-validator';
import { editObs } from './obs-adapter';
import { isNewSubmissionEffective } from './obs-comment-adapter';

export const InlineDateAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, context: FormContextProps) {
    // NOSONAR: inline date fields mutate their target field and do not submit their own value.
    if (!isStringValue(field.meta.targetField)) {
      return null;
    }
    const targetField = context.getFormField(field.meta.targetField);
    const targetFieldCurrentValue: unknown = context.methods.getValues(targetField.id);
    const dateString = isDateValue(value) ? toOmrsIsoString(value) : isStringValue(value) ? value : null;
    if (isFormFieldSubmissionValue(targetField.meta.submission?.newValue)) {
      if (isEmpty(dateString) && !isNewSubmissionEffective(targetField, targetFieldCurrentValue)) {
        // clear submission
        targetField.meta.submission.newValue = null;
      } else {
        targetField.meta.submission.newValue.obsDatetime = dateString;
      }
    } else if (!hasSubmission(targetField) && targetField.meta.initialValue?.omrsObject) {
      if (isEmpty(value) && isEmpty((targetField.meta.initialValue.omrsObject as OpenmrsResource)?.obsDatetime)) {
        return null;
      }
      // generate submission
      const newSubmission = editObs(targetField, targetFieldCurrentValue);
      targetField.meta.submission = {
        newValue: {
          ...newSubmission,
          obsDatetime: dateString,
        },
      };
    }
    return null;
  },
  getInitialValue: function (field: FormField, sourceObject: OpenmrsResource, context: FormProcessorContextProps) {
    const encounter = sourceObject ?? context.domainObjectValue;
    if (encounter) {
      const targetFieldId = field.id.split('_inline_date')[0];
      const targetField = context.formFields.find((field) => field.id === targetFieldId);
      const targetFieldInitialObs = targetField?.meta.initialValue?.omrsObject as OpenmrsResource;
      if (isStringValue(targetFieldInitialObs?.obsDatetime)) {
        return parseDate(targetFieldInitialObs.obsDatetime);
      }
      if (isDateValue(targetFieldInitialObs?.obsDatetime)) {
        return targetFieldInitialObs.obsDatetime;
      }
    }
    return null;
  },
  getPreviousValue: function (
    _field: FormField,
    _sourceObject: OpenmrsResource,
    _context: FormProcessorContextProps,
  ): null {
    return null;
  },
  getDisplayValue: function (_field: FormField, value: Date) {
    if (value) {
      return formatDate(value);
    }
    return null;
  },
  tearDown: function (): void {
    return;
  },
};
