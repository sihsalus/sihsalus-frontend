import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { ConceptFalse, ConceptTrue, type FormField } from '@sihsalus/esm-form-engine-lib';
import type { Schema } from '@types';
import type { ConfigObject } from '../config-schema';

interface ConceptMapping {
  type: string;
  value: string;
}

interface Field {
  label?: string;
  concept?: string;
  id?: string;
  type?: string;
}

interface ErrorMessageResponse {
  errorMessage?: string;
  field: Field;
}

interface WarningMessageResponse {
  field: Field;
  warningMessage?: string;
}

interface ConceptDatatype {
  name: string;
}

interface ConceptAnswerRef {
  uuid: string;
}

interface ConceptSearchResult {
  datatype: ConceptDatatype;
  answers: Array<ConceptAnswerRef>;
}

interface ConceptSearchResponse {
  results: Array<ConceptSearchResult>;
}

interface PatientIdentifierTypeResponse {
  data?: unknown;
}

function parseSchema(schema: string | Schema): Schema {
  return typeof schema === 'string' ? (JSON.parse(schema) as Schema) : schema;
}

function isConceptSearchResult(value: unknown): value is ConceptSearchResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'datatype' in value &&
    typeof value.datatype === 'object' &&
    value.datatype !== null &&
    'name' in value.datatype &&
    typeof value.datatype.name === 'string' &&
    'answers' in value &&
    Array.isArray(value.answers)
  );
}

function getConceptSearchResults(response: FetchResponse<ConceptSearchResponse>): Array<ConceptSearchResult> {
  return Array.isArray(response.data?.results) ? response.data.results.filter(isConceptSearchResult) : [];
}

function hasPatientIdentifierData(response: PatientIdentifierTypeResponse): boolean {
  return response.data !== undefined && response.data !== null;
}

function isConceptMapping(value: unknown): value is ConceptMapping {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'value' in value &&
    typeof value.value === 'string'
  );
}

export const handleFormValidation = async (
  schema: string | Schema,
  configObject: ConfigObject['dataTypeToRenderingMap'],
): Promise<[Array<ErrorMessageResponse>, Array<WarningMessageResponse>]> => {
  const errors: Array<ErrorMessageResponse> = [];
  const warnings: Array<WarningMessageResponse> = [];

  if (schema) {
    const parsedForm = parseSchema(schema);

    const asyncTasks: Array<Promise<void>> = [];

    parsedForm.pages?.forEach((page) => {
      page.sections?.forEach((section: { questions: Array<FormField> }) => {
        section.questions?.forEach((question) => {
          asyncTasks.push(
            handleQuestionValidation(question, errors, configObject, warnings),
            handleAnswerValidation(question, errors),
            handlePatientIdentifierValidation(question, errors),
          );
          if (question.type === 'obsGroup') {
            question?.questions?.forEach((obsGrpQuestion) => {
              asyncTasks.push(
                handleQuestionValidation(obsGrpQuestion, errors, configObject, warnings),
                handleAnswerValidation(obsGrpQuestion, errors),
              );
            });
          }
        });
      });
    });

    await Promise.all(asyncTasks);
  }

  return [errors, warnings]; // Return empty arrays if schema is falsy
};

const handleQuestionValidation = async (
  conceptObject: FormField,
  errorsArray: Array<ErrorMessageResponse>,
  configObject: ConfigObject['dataTypeToRenderingMap'],
  warningsArray: Array<WarningMessageResponse>,
) => {
  const conceptRepresentation =
    'custom:(uuid,display,datatype,answers,conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code)))';

  const conceptMappings = (conceptObject.questionOptions as { conceptMappings?: Array<ConceptMapping> } | undefined)
    ?.conceptMappings;
  const searchRef = conceptObject.questionOptions?.concept
    ? conceptObject.questionOptions.concept
    : conceptMappings?.length
      ? conceptMappings
          .map((mapping: ConceptMapping) => {
            return `${mapping.type}:${mapping.value}`;
          })
          .join(',')
      : '';

  if (searchRef) {
    try {
      const response = await openmrsFetch<ConceptSearchResponse>(
        `${restBaseUrl}/concept?references=${searchRef}&v=${conceptRepresentation}`,
      );
      const results = getConceptSearchResults(response);

      if (results.length) {
        const [resObject] = results;
        if (resObject.datatype.name === 'Boolean') {
          conceptObject.questionOptions.answers?.forEach((answer) => {
            if (answer.concept !== ConceptTrue && answer.concept !== ConceptFalse) {
              errorsArray.push({
                errorMessage: `❌ concept "${conceptObject.questionOptions.concept}" of type "boolean" has a non-boolean answer "${answer.label}"`,
                field: conceptObject,
              });
            }
          });
        }

        if (resObject.datatype.name === 'Coded') {
          conceptObject.questionOptions.answers?.forEach((answer) => {
            if (!resObject.answers.some((answerObject: { uuid: string }) => answerObject.uuid === answer.concept)) {
              warningsArray.push({
                warningMessage: `⚠️ answer: "${answer.label}" - "${answer.concept}" does not exist in the response answers but exists in the form`,
                field: conceptObject,
              });
            }
          });
        }

        dataTypeChecker(conceptObject, resObject, errorsArray, configObject);
      } else {
        errorsArray.push({
          errorMessage: `❓ Concept "${conceptObject.questionOptions.concept}" not found`,
          field: conceptObject,
        });
      }
    } catch (error) {
      console.error(error);
    }
  } else if (conceptObject.questionOptions.rendering !== 'workspace-launcher') {
    errorsArray.push({
      errorMessage: `❓ No UUID`,
      field: conceptObject,
    });
  }
};

const handlePatientIdentifierValidation = async (question: FormField, errors: Array<ErrorMessageResponse>) => {
  if (question.type === 'patientIdentifier' && !question.questionOptions.identifierType) {
    errors.push({
      errorMessage: `❓ Patient identifier type missing in schema`,
      field: question,
    });
  }
  const patientIdentifier = question.questionOptions.identifierType;

  if (patientIdentifier) {
    try {
      const response = await openmrsFetch<PatientIdentifierTypeResponse>(
        `${restBaseUrl}/patientidentifiertype/${question.questionOptions.identifierType}`,
      );
      if (!hasPatientIdentifierData(response)) {
        errors.push({
          errorMessage: `❓ The identifier type does not exist`,
          field: question,
        });
      }
    } catch (error) {
      console.error('Error fetching patient identifier:', error);
      errors.push({
        errorMessage: `❓ The identifier type does not exist`,
        field: question,
      });
    }
  }
};

const dataTypeChecker = (
  conceptObject: FormField,
  responseObject: { datatype: { name: string }; answers: Array<{ uuid: string }> },
  array: Array<ErrorMessageResponse>,
  dataTypeToRenderingMap: ConfigObject['dataTypeToRenderingMap'],
) => {
  const allowedRenderings = dataTypeToRenderingMap[responseObject.datatype.name];

  if (allowedRenderings) {
    if (!allowedRenderings.includes(conceptObject.questionOptions.rendering)) {
      array.push({
        errorMessage: `❓ ${conceptObject.questionOptions.concept}: datatype "${responseObject.datatype.name}" doesn't match control type "${conceptObject.questionOptions.rendering}"`,
        field: conceptObject,
      });
    }
  } else {
    array.push({
      errorMessage: `❓ Untracked datatype "${responseObject.datatype.name}"`,
      field: conceptObject,
    });
  }
};

const handleAnswerValidation = async (questionObject: FormField, array: Array<ErrorMessageResponse>) => {
  const answerArray = questionObject.questionOptions.answers;
  const conceptRepresentation =
    'custom:(uuid,display,datatype,conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code)))';

  if (answerArray?.length) {
    for (const answer of answerArray) {
      const conceptMappings = Array.isArray(answer.conceptMappings)
        ? answer.conceptMappings.filter(isConceptMapping)
        : [];
      const searchRef = answer.concept
        ? answer.concept
        : conceptMappings.length
          ? conceptMappings
              .map((eachMapping: ConceptMapping) => {
                return `${eachMapping.type}:${eachMapping.value}`;
              })
              .join(',')
          : '';

      try {
        const response = await openmrsFetch<ConceptSearchResponse>(
          `${restBaseUrl}/concept?references=${searchRef}&v=${conceptRepresentation}`,
        );
        if (!getConceptSearchResults(response).length) {
          array.push({
            errorMessage: `❌ concept "${answer.concept}" not found`,
            field: answer,
          });
        }
      } catch (error) {
        console.error('Error fetching concept:', error);
      }
    }
  }
};
