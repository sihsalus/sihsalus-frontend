import dayjs from 'dayjs';
import mapValues from 'lodash-es/mapValues';
import * as Yup from 'yup';

import { type FieldDefinition, type RegistrationConfig } from '../../config-schema';
import { patientFamilyNameMaxLength, patientGivenNameMaxLength } from '../patient-name-limits';
import { getDatetime } from '../patient-registration.resource';
import {
  type FetchedPatientIdentifierType,
  type FormValues,
  type RelationshipValue,
} from '../patient-registration.types';
import { getPeruIdentifierRule } from '../peru-identifier-validation';
import { validateRequiredField } from './required-field-validation';

const t = (key: string, _value: string) => key;

/**
 * Allowed characters for a person name: must start with a Unicode letter and may
 * contain additional letters, combining marks (accents), spaces, hyphens, apostrophes
 * and periods. This blocks digits and symbols such as `@`, `#`, `/`, etc. while still
 * supporting names like "O'Brien", "De la Cruz" or "Jean-Pierre".
 */
const nameRegex = /^\p{L}[\p{L}\p{M}'.\- ]*$/u;
const nameInvalidCharactersMessage = t(
  'nameContainsInvalidCharacters',
  'Name can only contain letters, spaces, hyphens and apostrophes',
);
const nameTooShortMessage = t('nameTooShort', 'Name must be at least 2 characters long');
const givenNameTooLongMessage = t('givenNameTooLong', 'Name must be 150 characters or fewer');
const familyNameTooLongMessage = t('familyNameTooLong', 'Family name must be 100 characters or fewer');
const insuranceAccreditationCheckedAtFieldId = 'insuranceAccreditationCheckedAt';
const insuranceAccreditationDateBeforeBirthdateMessage = t(
  'insuranceAccreditationDateBeforeBirthdate',
  'Insurance accreditation date cannot be before date of birth',
);

function parseDateOnly(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    const parsedDate = dayjs(value);
    return parsedDate.isValid() ? parsedDate.startOf('day') : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, yearValue, monthValue, dayValue] = dateOnlyMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const parsedDate = new Date(year, month - 1, day);

    if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
      return undefined;
    }

    return dayjs(parsedDate).startOf('day');
  }

  const parsedDate = dayjs(value);
  return parsedDate.isValid() ? parsedDate.startOf('day') : undefined;
}

function buildIdentifierFormatRegex(format?: string): RegExp | undefined {
  if (!format) {
    return undefined;
  }
  try {
    return new RegExp(format);
  } catch {
    return undefined;
  }
}

function buildPersonAttributeValidationSchema(config: RegistrationConfig) {
  const attributeSchemas = Object.fromEntries(
    (config.fieldDefinitions ?? [])
      .filter(
        (field) =>
          field.type === 'person attribute' && !!field.uuid && (!!field.validation || field.inputType === 'date'),
      )
      .map((field) => {
        const formatRegex = buildIdentifierFormatRegex(field.validation?.matches);
        let schema = Yup.string().nullable();

        if (field.validation?.required) {
          schema = schema.required(t('fieldRequired', 'Field is required'));
        }

        if (formatRegex) {
          schema = schema.test('person-attribute-format', t('invalidInput', 'Invalid Input'), (value) => {
            if (!value) {
              return true;
            }

            return formatRegex.test(value.trim());
          });
        }

        if (field.inputType === 'date') {
          schema = schema
            .test(
              'person-attribute-date',
              t('invalidDate', 'Invalid date'),
              (value) => !value || !!parseDateOnly(value),
            )
            .test(
              'person-attribute-date-not-in-future',
              t('dateCannotBeInFuture', 'Date cannot be in future'),
              (value) => {
                const parsedDate = parseDateOnly(value);
                return field.allowFutureDates !== false || !parsedDate || !parsedDate.isAfter(dayjs(), 'day');
              },
            )
            .test('person-attribute-date-not-in-past', t('dateCannotBeInPast', 'Date cannot be in past'), (value) => {
              const parsedDate = parseDateOnly(value);
              return field.allowPastDates !== false || !parsedDate || !parsedDate.isBefore(dayjs(), 'day');
            });
        }

        return [field.uuid, schema];
      }),
  );

  return Yup.object(attributeSchemas);
}

function buildRegistrationObsValidationSchema(config: RegistrationConfig) {
  const obsSchemas = Object.fromEntries(
    (config.fieldDefinitions ?? [])
      .filter((field) => field.type === 'obs' && !!field.uuid && field.validation?.required)
      .map((field) => [
        field.uuid,
        Yup.mixed().test('required', t('fieldRequired', 'Field is required'), (value) => !validateRequiredField(value)),
      ]),
  );

  return Yup.object(obsSchemas);
}

function buildCustomAddressValidationSchema(config: RegistrationConfig) {
  return Object.fromEntries(
    (config.fieldDefinitions ?? [])
      .filter((field) => field.type === 'address' && field.validation?.required)
      .map((field) => [field.id, Yup.string().required(t('fieldRequired', 'Field is required'))]),
  );
}

function getPersonAttributeFieldUuid(config: RegistrationConfig, fieldId: string) {
  return config.fieldDefinitions?.find((field) => field.type === 'person attribute' && field.id === fieldId)?.uuid;
}

function getAttributeValue(values: FormValues | undefined, attributeTypeUuid: FieldDefinition['uuid'] | undefined) {
  return attributeTypeUuid ? values?.attributes?.[attributeTypeUuid] : undefined;
}

export function isMinorPatient(values: Pick<FormValues, 'birthdate' | 'birthdateEstimated' | 'yearsEstimated'>) {
  if (values.birthdateEstimated) {
    return typeof values.yearsEstimated === 'number' && values.yearsEstimated < 18;
  }

  if (!values.birthdate) {
    return false;
  }

  return dayjs().diff(dayjs(values.birthdate), 'year') < 18;
}

function getAgeFromBirthdate(birthdate?: string) {
  if (!birthdate) {
    return undefined;
  }

  const parsedBirthdate = dayjs(birthdate);
  if (!parsedBirthdate.isValid()) {
    return undefined;
  }

  return dayjs().diff(parsedBirthdate, 'year');
}

/**
 * A relationship row points to a person either because an existing person was selected
 * (`relatedPersonUuid`) or because a new responsible person is pending creation at
 * submit time (`newPerson`, created together with its relationship to avoid orphans).
 */
export function hasRelatedPerson(relationship: RelationshipValue) {
  return !!relationship.relatedPersonUuid || (relationship.action === 'ADD' && !!relationship.newPerson);
}

export function hasResponsibleRelationship(
  relationships: Array<RelationshipValue> | undefined,
  minorResponsibleRelationshipTypes: Array<string> = [],
) {
  return (
    relationships?.some(
      (relationship) =>
        relationship.action !== 'DELETE' &&
        hasRelatedPerson(relationship) &&
        relationship.isCompanion &&
        !!relationship.relationshipType &&
        minorResponsibleRelationshipTypes.includes(relationship.relationshipType) &&
        !isUnderageResponsibleRelationship(relationship, minorResponsibleRelationshipTypes),
    ) ?? false
  );
}

const fatherRelationshipTypeUuid = '8d91a210-c2cc-11de-8d13-0010c6dffd0f';

function normalizeRelationshipLabel(value?: string) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function isActiveCompleteRelationship(relationship: RelationshipValue) {
  return relationship.action !== 'DELETE' && !!relationship.relationshipType && hasRelatedPerson(relationship);
}

export function hasMultipleFatherRelationships(relationships: Array<RelationshipValue> | undefined) {
  const fatherRelationships =
    relationships?.filter((relationship) => {
      if (!isActiveCompleteRelationship(relationship)) {
        return false;
      }

      const [relationshipTypeUuid, direction] = relationship.relationshipType.split('/');
      return (
        (relationshipTypeUuid === fatherRelationshipTypeUuid && direction === 'aIsToB') ||
        ['father', 'padre'].includes(normalizeRelationshipLabel(relationship.relation))
      );
    }) ?? [];

  return fatherRelationships.length > 1;
}

export function hasMultiplePrimaryResponsiblePersons(relationships: Array<RelationshipValue> | undefined) {
  return (
    (relationships?.filter((relationship) => isActiveCompleteRelationship(relationship) && relationship.isCompanion)
      .length ?? 0) > 1
  );
}

export function isUnderageResponsibleRelationship(
  relationship: RelationshipValue,
  minorResponsibleRelationshipTypes: Array<string> = [],
) {
  if (
    relationship.action === 'DELETE' ||
    !relationship.isCompanion ||
    !relationship.relationshipType ||
    !minorResponsibleRelationshipTypes.includes(relationship.relationshipType)
  ) {
    return false;
  }

  const newPersonAge = relationship.newPerson?.estimatedAge?.trim();
  if (newPersonAge) {
    return Number(newPersonAge) < 18;
  }

  const relatedPersonAge = relationship.relatedPersonAge ?? getAgeFromBirthdate(relationship.relatedPersonBirthdate);
  return typeof relatedPersonAge === 'number' && relatedPersonAge < 18;
}

export function hasUnderageResponsibleRelationship(
  relationships: Array<RelationshipValue> | undefined,
  minorResponsibleRelationshipTypes: Array<string> = [],
) {
  return (
    relationships?.some((relationship) =>
      isUnderageResponsibleRelationship(relationship, minorResponsibleRelationshipTypes),
    ) ?? false
  );
}

function isUnidentifiedPatient(values: FormValues, config: RegistrationConfig) {
  const unidentifiedPatientAttributeTypeUuid = config.fieldConfigurations.name?.unidentifiedPatientAttributeTypeUuid;

  return !!unidentifiedPatientAttributeTypeUuid && values.attributes?.[unidentifiedPatientAttributeTypeUuid] === 'true';
}

function hasActiveRelationship(relationships: Array<RelationshipValue> | undefined) {
  return (
    relationships?.some(
      (relationship) =>
        relationship.action !== 'DELETE' && hasRelatedPerson(relationship) && !!relationship.relationshipType,
    ) ?? false
  );
}

export function getValidationSchema(
  config: RegistrationConfig,
  identifierTypes: Array<FetchedPatientIdentifierType> = [],
) {
  const insuranceAccreditationCheckedAtAttributeUuid = getPersonAttributeFieldUuid(
    config,
    insuranceAccreditationCheckedAtFieldId,
  );

  return Yup.object({
    ...buildCustomAddressValidationSchema(config),
    givenName: Yup.string()
      .required(t('givenNameRequired', 'Given name is required'))
      .min(2, nameTooShortMessage)
      .max(patientGivenNameMaxLength, givenNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true }),
    familyName: Yup.string()
      .required(t('familyNameRequired', 'Family name is required'))
      .min(2, nameTooShortMessage)
      .max(patientFamilyNameMaxLength, familyNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true }),
    middleName: Yup.string()
      .max(patientGivenNameMaxLength, givenNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true }),
    familyName2: (config.fieldConfigurations.name.requireFamilyName2
      ? Yup.string()
          .required(t('familyName2Required', 'Second family name is required'))
          .min(2, nameTooShortMessage)
          .max(patientFamilyNameMaxLength, familyNameTooLongMessage)
      : Yup.string().notRequired()
    )
      .max(patientFamilyNameMaxLength, familyNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true }),
    additionalGivenName: Yup.string()
      .max(patientGivenNameMaxLength, givenNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true })
      .when('addNameInLocalLanguage', {
        is: true,
        // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
        then: Yup.string()
          .required(t('givenNameRequired', 'Given name is required'))
          .min(2, nameTooShortMessage)
          .max(patientGivenNameMaxLength, givenNameTooLongMessage),
        otherwise: Yup.string().notRequired(),
      }),
    additionalMiddleName: Yup.string().max(patientGivenNameMaxLength, givenNameTooLongMessage).matches(nameRegex, {
      message: nameInvalidCharactersMessage,
      excludeEmptyString: true,
    }),
    additionalFamilyName: Yup.string()
      .max(patientFamilyNameMaxLength, familyNameTooLongMessage)
      .matches(nameRegex, { message: nameInvalidCharactersMessage, excludeEmptyString: true })
      .when('addNameInLocalLanguage', {
        is: true,
        // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
        then: Yup.string()
          .required(t('familyNameRequired', 'Family name is required'))
          .min(2, nameTooShortMessage)
          .max(patientFamilyNameMaxLength, familyNameTooLongMessage),
        otherwise: Yup.string().notRequired(),
      }),
    additionalFamilyName2: Yup.string().max(patientFamilyNameMaxLength, familyNameTooLongMessage).matches(nameRegex, {
      message: nameInvalidCharactersMessage,
      excludeEmptyString: true,
    }),
    gender: Yup.string()
      .oneOf(
        config.fieldConfigurations.gender.map((g) => g.value),
        t('genderUnspecified', 'Gender unspecified'),
      )
      .required(t('genderRequired', 'Gender is required')),
    birthdate: Yup.date().when('birthdateEstimated', {
      is: false,
      // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
      then: Yup.date()
        .required(t('birthdayRequired', 'Birthday is required'))
        .max(Date(), t('birthdayNotInTheFuture', 'Birthday cannot be in future'))
        .min(
          dayjs().subtract(140, 'years').toDate(),
          t('birthdayNotOver140YearsAgo', 'Birthday cannot be more than 140 years ago'),
        )
        .nullable(),
      otherwise: Yup.date().nullable(),
    }),
    yearsEstimated: Yup.number().when('birthdateEstimated', {
      is: true,
      // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
      then: Yup.number()
        .required(t('yearsEstimateRequired', 'Estimated years required'))
        .min(0, t('negativeYears', 'Estimated years cannot be negative'))
        .max(140, t('nonsensicalYears', 'Estimated years cannot be more than 140')),
      otherwise: Yup.number().nullable(),
    }),
    monthsEstimated: Yup.number().min(0, t('negativeMonths', 'Estimated months cannot be negative')),
    isDead: Yup.boolean(),
    deathDate: Yup.date()
      .when('isDead', {
        is: true,
        // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
        then: Yup.date().required(t('deathDateRequired', 'Death date is required')),
        otherwise: Yup.date().nullable(),
      })
      .max(new Date(), 'deathDateInFuture')
      .test(
        'deathDate-after-birthdate',
        t('deathdayInvalidDate', 'Death date and time cannot be before the birthday'),
        function (value) {
          const { birthdate } = this.parent;
          if (birthdate && value) {
            return dayjs(value).isAfter(birthdate);
          }
          return true;
        },
      )
      .test('deathDate-before-today', t('deathDateInFuture', 'Death date cannot be in future'), function (value) {
        const { deathTime, deathTimeFormat } = this.parent;
        if (value && deathTime && deathTimeFormat && /^(1[0-2]|0?[1-9]):([0-5]?[0-9])$/.test(deathTime)) {
          return dayjs(getDatetime(value, deathTime, deathTimeFormat)).isBefore(dayjs());
        }
        return true;
      }),
    deathTime: Yup.string()
      .when('isDead', {
        is: true,
        // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
        then: Yup.string().required(t('deathTimeRequired', 'Death time is required')),
        otherwise: Yup.string().nullable(),
      })
      .matches(/^(1[0-2]|0?[1-9]):([0-5]?[0-9])$/, t('deathTimeInvalid', "Time doesn't match the format 'hh:mm'")),

    deathTimeFormat: Yup.string()
      .when('isDead', {
        is: true,
        // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
        then: Yup.string().required(t('deathTimeFormatRequired', 'Time format is required')),
        otherwise: Yup.string().nullable(),
      })
      .oneOf(['AM', 'PM'], t('deathTimeFormatInvalid', 'Time format is invalid')),

    deathCause: Yup.string().when('isDead', {
      is: true,
      // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
      then: Yup.string().required(t('deathCauseRequired', 'Cause of death is required')),
      otherwise: Yup.string().nullable(),
    }),
    nonCodedCauseOfDeath: Yup.string().when(['isDead', 'deathCause'], {
      is: (isDead, deathCause) => isDead && deathCause === config.freeTextFieldConceptUuid,
      // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
      then: Yup.string().required(t('nonCodedCauseOfDeathRequired', 'Cause of death is required')),
      otherwise: Yup.string().nullable(),
    }),
    email: Yup.string().optional().email(t('invalidEmail', 'Invalid email')),
    attributes: buildPersonAttributeValidationSchema(config),
    obs: buildRegistrationObsValidationSchema(config),
    identifiers: Yup.lazy((obj: FormValues['identifiers']) =>
      Yup.object(
        mapValues(obj, (identifier, fieldName) => {
          const identifierType = identifierTypes.find(
            (type) => type.fieldName === fieldName || type.uuid === identifier?.identifierTypeUuid,
          );
          const peruIdentifierRule = getPeruIdentifierRule(identifierType, identifier);
          const formatRegex = peruIdentifierRule?.pattern ?? buildIdentifierFormatRegex(identifierType?.format);

          return Yup.object({
            required: Yup.bool(),
            identifierValue: Yup.string()
              .when('required', {
                is: true,
                // biome-ignore lint/suspicious/noThenProperty: Yup's conditional schema API requires the `then` property.
                then: Yup.string().required(t('identifierValueRequired', 'Identifier value is required')),
                otherwise: Yup.string().notRequired(),
              })
              .test(
                'identifier-format',
                peruIdentifierRule
                  ? t(peruIdentifierRule.messageKey, peruIdentifierRule.message)
                  : t('identifierInvalidFormat', 'Identifier does not match the expected format'),
                function (value) {
                  // Skip when there is no backend format, the field is empty, or the value
                  // is auto-generated by the server (validated server-side).
                  if (!formatRegex || !value || value === 'auto-generated') {
                    return true;
                  }
                  return formatRegex.test(value.trim());
                },
              ),
          });
        }),
      ),
    ),
    relationships: Yup.array()
      .of(
        Yup.object()
          .shape({
            relatedPersonUuid: Yup.string(),
            relationshipType: Yup.string().required(),
          })
          .test(
            'related-person-selected-or-pending',
            t('relationshipPersonMustExist', 'Family member or companion must be an existing person'),
            (relationship) => hasRelatedPerson(relationship as RelationshipValue),
          ),
      )
      .test(
        'patient-has-only-one-father',
        t('patientCanOnlyHaveOneFather', 'The patient can only have one father'),
        (relationships?: Array<RelationshipValue>) => !hasMultipleFatherRelationships(relationships),
      )
      .test(
        'patient-has-only-one-primary-responsible',
        t('patientCanOnlyHaveOnePrimaryResponsible', 'Select only one primary responsible person'),
        (relationships?: Array<RelationshipValue>) => !hasMultiplePrimaryResponsiblePersons(relationships),
      )
      .test(
        'responsible-relationship-must-be-adult',
        t('responsiblePersonMustBeAdult', 'Responsible person must be an adult'),
        function (relationships?: Array<RelationshipValue>) {
          const values = this.parent as FormValues;
          return (
            !isMinorPatient(values) ||
            !hasUnderageResponsibleRelationship(
              relationships,
              config.relationshipOptions?.minorResponsibleRelationshipTypes,
            )
          );
        },
      )
      .test(
        'responsible-relationship-required-for-minors',
        t(
          'responsibleRelationshipRequiredForMinor',
          'For minors, record a responsible family member, guardian, or legal representative.',
        ),
        function (relationships?: Array<RelationshipValue>) {
          const values = this.parent as FormValues;
          return (
            !isMinorPatient(values) ||
            hasUnderageResponsibleRelationship(
              relationships,
              config.relationshipOptions?.minorResponsibleRelationshipTypes,
            ) ||
            hasResponsibleRelationship(relationships, config.relationshipOptions?.minorResponsibleRelationshipTypes)
          );
        },
      )
      .test(
        'responsible-required-for-unidentified-patient',
        t(
          'responsibleRequiredForUnidentifiedPatient',
          'A responsible person or institution is required for unidentified patients',
        ),
        function (relationships?: Array<RelationshipValue>) {
          const values = this.parent as FormValues;
          return !isUnidentifiedPatient(values, config) || hasActiveRelationship(relationships);
        },
      ),
  }).test(
    'insurance-accreditation-date-after-birthdate',
    insuranceAccreditationDateBeforeBirthdateMessage,
    function (values) {
      const formValues = values as unknown as FormValues | undefined;
      const insuranceAccreditationCheckedAt = parseDateOnly(
        getAttributeValue(formValues, insuranceAccreditationCheckedAtAttributeUuid),
      );
      const birthdate = parseDateOnly(formValues?.birthdate);

      if (
        !insuranceAccreditationCheckedAt ||
        !birthdate ||
        !insuranceAccreditationCheckedAt.isBefore(birthdate, 'day')
      ) {
        return true;
      }

      return this.createError({
        path: `attributes.${insuranceAccreditationCheckedAtAttributeUuid}`,
        message: insuranceAccreditationDateBeforeBirthdateMessage,
      });
    },
  );
}
