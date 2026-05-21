import { type OpenmrsResource, showSnackbar } from '@openmrs/esm-framework';
import { type TFunction } from 'i18next';
import { type PostSubmissionActionMeta } from '../hooks/usePostSubmissionActions';
import { type OpenmrsEncounter, type SessionMode } from '../types';
import { isPlainObject } from '../utils/common-utils';
import { extractErrorMessagesFromResponse } from '../utils/error-utils';
import { evaluatePostSubmissionExpression } from '../utils/post-submission-action-helper';
import { type FormContextProps } from './form-provider';

interface SubmissionFetchResponse extends OpenmrsResource {
  data?: OpenmrsEncounter;
}

export function validateForm(context: FormContextProps): boolean {
  const {
    formFields,
    formFieldValidators,
    patient,
    sessionMode,
    addInvalidField,
    updateFormField,
    methods: { getValues },
  } = context;
  const values = getValues() as Record<string, unknown>;
  const errors = formFields
    .filter(
      (field) => !field.isHidden && !field.isParentHidden && !field.isDisabled && !field.meta.submission?.unspecified,
    )
    .flatMap((field) =>
      field.validators?.flatMap((validatorConfig) => {
        const validator = formFieldValidators[validatorConfig.type];
        if (validator) {
          const validationResults = validator.validate(field, values[field.id], {
            formFields,
            values,
            expressionContext: {
              patient,
              mode: sessionMode,
            },
            ...validatorConfig,
          });
          const errors = validationResults.filter((result) => result.resultType === 'error');
          if (errors.length) {
            field.meta.submission = { ...field.meta.submission, errors };
            updateFormField(field);
            addInvalidField(field);
          }
          return errors;
        }

        return [];
      }),
    )
    .filter((error) => Boolean(error));
  return errors.length === 0;
}

export async function processPostSubmissionActions(
  postSubmissionHandlers: PostSubmissionActionMeta[],
  submissionResults: Array<OpenmrsResource | SubmissionFetchResponse>,
  patient: fhir.Patient,
  sessionMode: SessionMode,
  t: TFunction,
): Promise<void[]> {
  return Promise.all(
    postSubmissionHandlers.map(async ({ postAction, config, actionId, enabled }) => {
      try {
        const encounterData: OpenmrsEncounter[] = [];
        if (submissionResults) {
          submissionResults.forEach((result) => {
            if (isSubmissionFetchResponse(result) && result.data) {
              encounterData.push(result.data);
            }
            if (result?.uuid) {
              encounterData.push(result as OpenmrsEncounter);
            }
          });

          if (encounterData.length) {
            const isActionEnabled = enabled ? evaluatePostSubmissionExpression(enabled, encounterData) : true;
            if (isActionEnabled) {
              await postAction.applyAction(
                {
                  patient,
                  sessionMode,
                  encounters: encounterData,
                },
                config,
              );
            }
          } else {
            throw new Error('No encounter data to process post submission action');
          }
        } else {
          throw new Error('No handlers available to process post submission action');
        }
      } catch (error) {
        const errorMessages = extractErrorMessagesFromResponse(error);
        showSnackbar({
          title: String(
            t(
              'errorDescriptionTitle',
              actionId ? actionId.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Post Submission Error',
            ),
          ),
          subtitle: String(t('errorDescription', '{{errors}}', { errors: errorMessages.join(', ') })),
          kind: 'error',
          isLowContrast: false,
        });
      }
    }),
  );
}

function isSubmissionFetchResponse(value: OpenmrsResource | SubmissionFetchResponse): value is SubmissionFetchResponse {
  return isPlainObject(value) && 'data' in value;
}
