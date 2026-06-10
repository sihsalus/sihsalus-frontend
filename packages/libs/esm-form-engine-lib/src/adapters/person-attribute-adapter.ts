import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { type FormContextProps } from '../provider/form-provider';
import { type FormField, type FormFieldValueAdapter, type FormProcessorContextProps } from '../types';
import { clearSubmission, isPlainObject, isStringValue } from '../utils/common-utils';
import { isEmpty } from '../validators/form-validator';

const personAttributeExtensionUrl = (attributeType: string) =>
  `http://fhir.openmrs.org/ext/person-attribute/${attributeType}`;

export const PersonAttributeAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, _context: FormContextProps): unknown {
    clearSubmission(field);
    if (!isStringValue(value) || field.meta.initialValue?.refinedValue === value || isEmpty(value)) {
      return null;
    }

    field.meta.submission.newValue = {
      value,
      attributeType: field.questionOptions.attributeType,
      uuid: getPersonAttributeUuid(field.meta.initialValue?.omrsObject),
    };
    return field.meta.submission.newValue;
  },
  getInitialValue: function (
    field: FormField,
    _sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): string | undefined {
    const attributeType = field.questionOptions.attributeType;
    const latestAttribute = attributeType
      ? context.patient?.extension?.find((ext) => ext.url === personAttributeExtensionUrl(attributeType))
      : undefined;
    const refinedValue = latestAttribute?.valueString ?? latestAttribute?.valueReference?.reference;

    field.meta = {
      ...(field.meta || {}),
      initialValue: {
        omrsObject: toOpenmrsAttributeResource(latestAttribute),
        refinedValue,
      },
    };
    return refinedValue;
  },
  getPreviousValue: function (): null {
    return null;
  },
  getDisplayValue: function (_field: FormField, value: unknown): unknown {
    if (isPlainObject(value) && typeof value.display === 'string') {
      return value.display;
    }
    return value;
  },
  tearDown: function (): void {
    return;
  },
};

function toOpenmrsAttributeResource(attribute: fhir.Extension | undefined): OpenmrsResource | undefined {
  if (!attribute) {
    return undefined;
  }

  const value = attribute.valueString ?? attribute.valueReference?.reference;
  return {
    uuid: attribute.id ?? value,
    display: value,
  } as OpenmrsResource;
}

function getPersonAttributeUuid(value: unknown): string | undefined {
  return isPlainObject(value) && typeof value.uuid === 'string' ? value.uuid : undefined;
}
