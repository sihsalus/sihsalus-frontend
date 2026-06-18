import dayjs from 'dayjs';
import mapValues from 'lodash-es/mapValues';
import * as Yup from 'yup';

import { type RegistrationConfig } from '../../config-schema';
import { patientFamilyNameMaxLength, patientGivenNameMaxLength } from '../patient-name-limits';
import { getDatetime } from '../patient-registration.resource';
import {
  type FetchedPatientIdentifierType,
  type FormValues,
  type RelationshipValue,
} from '../patient-registration.types';
import { getPeruIdentifierRule } from '../peru-identifier-validation';

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
      .filter((field) => field.type === 'person attribute' && !!field.uuid && !!field.validation)
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

        return [field.uuid, schema];
      }),
  );

  return Yup.object(attributeSchemas);
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

export function hasResponsibleRelationship(
  relationships: Array<RelationshipValue> | undefined,
  minorResponsibleRelationshipTypes: Array<string> = [],
) {
  return (
    relationships?.some(
      (relationship) =>
        relationship.action !== 'DELETE' &&
        !!relationship.relatedPersonUuid &&
        !!relationship.relationshipType &&
        minorResponsibleRelationshipTypes.includes(relationship.relationshipType),
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
        relationship.action !== 'DELETE' && !!relationship.relatedPersonUuid && !!relationship.relationshipType,
    ) ?? false
  );
}

export function getValidationSchema(
  config: RegistrationConfig,
  identifierTypes: Array<FetchedPatientIdentifierType> = [],
) {
  return Yup.object({
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
        Yup.object().shape({
          relatedPersonUuid: Yup.string().required(),
          relationshipType: Yup.string().required(),
        }),
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
  });
}
