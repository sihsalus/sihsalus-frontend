import { type OpenmrsResource, showSnackbar, translateFrom } from '@openmrs/esm-framework';
import { type TOptions } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPreviousEncounter, saveEncounter } from '../../api';
import { formEngineAppName } from '../../globals';
import { useEncounter } from '../../hooks/useEncounter';
import { useEncounterRole } from '../../hooks/useEncounterRole';
import { usePatientPrograms } from '../../hooks/usePatientPrograms';
import { type FormContextProps } from '../../provider/form-provider';
import {
  type FormField,
  type FormPage,
  type FormProcessorContextProps,
  type FormSchema,
  type FormSection,
  type OpenmrsEncounter,
  type PatientProgram,
  type ValueAndDisplay,
} from '../../types';
import { hasRendering, isPlainObject, isStringValue } from '../../utils/common-utils';
import { extractErrorMessagesFromResponse, FormSubmissionError } from '../../utils/error-utils';
import { evaluateAsyncExpression, type FormNode } from '../../utils/expression-runner';
import { extractObsValueAndDisplay } from '../../utils/form-helper';
import { isEmpty } from '../../validators/form-validator';
import { FormProcessor, type GetCustomHooksResponse } from '../form-processor';
import {
  getMutableSessionProps,
  hasDuplicatePatientIdentifiers,
  hydrateRepeatField,
  inferInitialValueFromDefaultFieldValue,
  prepareEncounter,
  preparePatientIdentifiers,
  preparePatientPrograms,
  preparePersonAttributes,
  saveAttachments,
  savePatientIdentifiers,
  savePatientPrograms,
  savePersonAttributes,
} from './encounter-processor-helper';

type FormValues = Record<string, unknown>;

type CustomHooksResult = ReturnType<GetCustomHooksResponse['useCustomHooks']>;

function useCustomHooks(context: Partial<FormProcessorContextProps>): CustomHooksResult {
  const [isLoading, setIsLoading] = useState(true);
  const { encounter, isLoading: isLoadingEncounter } = useEncounter(context.formJson);
  const { encounterRole, isLoading: isLoadingEncounterRole } = useEncounterRole();
  const { isLoadingPatientPrograms, patientPrograms } = usePatientPrograms(context.patient?.id, context.formJson);
  const encounterResource = useMemo(() => getEncounterResource(encounter), [encounter]);
  const patientProgramUuids = useMemo(
    () =>
      (patientPrograms ?? [])
        .map((program) => program.uuid)
        .sort((a, b) => a.localeCompare(b))
        .join(','),
    [patientPrograms],
  );

  useEffect(() => {
    setIsLoading(isLoadingPatientPrograms || isLoadingEncounter || isLoadingEncounterRole);
  }, [isLoadingPatientPrograms, isLoadingEncounter, isLoadingEncounterRole]);

  const updateContext = useCallback(
    (setContext: React.Dispatch<React.SetStateAction<FormProcessorContextProps>>): void => {
      setContext((context) => {
        const previousEncounterUuid = isOpenmrsEncounter(context.domainObjectValue)
          ? context.domainObjectValue.uuid
          : null;
        const nextEncounterUuid = encounterResource?.uuid ?? null;
        const previousEncounterRoleUuid = isPlainObject(context.customDependencies?.defaultEncounterRole)
          ? context.customDependencies?.defaultEncounterRole?.uuid
          : undefined;
        const nextEncounterRoleUuid = encounterRole?.uuid;
        const previousPatientPrograms = asPatientPrograms(context.customDependencies?.patientPrograms);
        const previousPatientProgramUuids = previousPatientPrograms
          .map((program) => program.uuid)
          .sort((a, b) => a.localeCompare(b))
          .join(',');

        if (
          previousEncounterUuid === nextEncounterUuid &&
          previousEncounterRoleUuid === nextEncounterRoleUuid &&
          previousPatientProgramUuids === patientProgramUuids
        ) {
          return context;
        }

        context.processor.domainObjectValue = encounterResource;
        return {
          ...context,
          domainObjectValue: encounterResource,
          customDependencies: {
            ...context.customDependencies,
            patientPrograms,
            defaultEncounterRole: encounterRole,
          },
        };
      });
    },
    [encounterResource, encounterRole, patientProgramUuids, patientPrograms],
  );

  return {
    data: { encounter, patientPrograms, encounterRole },
    isLoading,
    error: null,
    updateContext,
  };
}

const emptyValues: Record<string, unknown> = {
  checkbox: [],
  toggle: false,
  text: '',
};

const contextInitializableTypes = new Set([
  'encounterProvider',
  'encounterDatetime',
  'encounterLocation',
  'patientIdentifier',
  'encounterRole',
  'programState',
  'personAttribute',
]);

export class EncounterFormProcessor extends FormProcessor {
  prepareFormSchema(schema: FormSchema): FormSchema {
    const allFieldIds = new Set<string>();

    schema.pages.forEach((page) => {
      page.sections.forEach((section) => {
        section.questions.forEach((question) => {
          prepareFormField(question, section, page, schema);
        });
      });
    });

    function prepareFormField(field: FormField, section: FormSection, page: FormPage, schema: FormSchema): void {
      // Collect field ID
      if (field.id) {
        allFieldIds.add(field.id);
      }

      // inherit inlineRendering and readonly from parent section and page if not set
      field.inlineRendering =
        field.inlineRendering ?? section.inlineRendering ?? page.inlineRendering ?? schema.inlineRendering;
      field.readonly = field.readonly ?? section.readonly ?? page.readonly ?? schema.readonly;
      if (field.questionOptions?.rendering === 'fixed-value' && !field.meta.fixedValue) {
        field.meta.fixedValue = field.value;
        delete field.value;
      }
      if (field.questionOptions?.rendering === 'group' || field.type === 'obsGroup') {
        field.questions?.forEach((child) => {
          child.readonly = child.readonly ?? field.readonly;
          prepareFormField(child, section, page, schema);
        });
      }
    }

    // Validate calculate expressions for common mistakes
    validateCalculateExpressions(schema, allFieldIds);

    return schema;
  }

  async processSubmission(context: FormContextProps, abortController: AbortController): Promise<OpenmrsResource> {
    const { encounterRole, encounterProvider, encounterDate, encounterLocation } = getMutableSessionProps(context);
    const t = (key: string, defaultValue: string, options?: Omit<TOptions, 'ns' | 'defaultValue'>): string =>
      translateFrom(formEngineAppName, key, defaultValue, options);
    const patientIdentifiers = preparePatientIdentifiers(context.formFields, encounterLocation);
    const hasDuplicateIdentifiers = await hasDuplicatePatientIdentifiers(context.patient, patientIdentifiers);
    if (hasDuplicateIdentifiers) {
      throw new FormSubmissionError({
        title: t('patientIdentifierDuplication', 'Patient identifier duplication'),
        subtitle: t(
          'patientIdentifierDuplicationDescription',
          'The identifier provided is already associated with an existing patient. Please check the identifier and try again.',
        ),
        kind: 'error',
        isLowContrast: false,
      });
    }
    const encounter = await prepareEncounter(
      context,
      encounterDate,
      encounterRole,
      encounterProvider,
      encounterLocation,
    );
    const currentPatientPrograms = asPatientPrograms(context.customDependencies?.patientPrograms);

    // save patient identifiers
    try {
      await Promise.all(savePatientIdentifiers(context.patient, patientIdentifiers));
      if (patientIdentifiers?.length) {
        showSnackbar({
          title: t('patientIdentifiersSaved', 'Patient identifier(s) saved successfully'),
          kind: 'success',
          isLowContrast: true,
        });
      }
    } catch (error) {
      const errorMessages = extractErrorMessagesFromResponse(error);
      throw new FormSubmissionError({
        title: t('errorSavingPatientIdentifiers', 'Error saving patient identifiers'),
        subtitle: errorMessages.join(', '),
        kind: 'error',
        isLowContrast: false,
      });
    }

    // save person attributes
    try {
      const personAttributes = preparePersonAttributes(context.formFields);
      await Promise.all(savePersonAttributes(context.patient, personAttributes));
      if (personAttributes?.length) {
        showSnackbar({
          title: t('personAttributesSaved', 'Person attribute(s) saved successfully'),
          kind: 'success',
          isLowContrast: true,
        });
      }
    } catch (error) {
      const errorMessages = extractErrorMessagesFromResponse(error);
      throw new FormSubmissionError({
        title: t('errorSavingPersonAttributes', 'Error saving person attributes'),
        subtitle: errorMessages.join(', '),
        kind: 'error',
        isLowContrast: false,
      });
    }

    // save patient programs
    try {
      const programs = preparePatientPrograms(context.formFields, context.patient, currentPatientPrograms);
      const savedPrograms = await savePatientPrograms(programs);
      if (savedPrograms?.length) {
        showSnackbar({
          title: t('patientProgramsSaved', 'Patient program(s) saved successfully'),
          kind: 'success',
          isLowContrast: true,
        });
      }
    } catch (error) {
      const errorMessages = extractErrorMessagesFromResponse(error);
      throw new FormSubmissionError({
        title: t('errorSavingPatientPrograms', 'Error saving patient program(s)'),
        subtitle: errorMessages.join(', '),
        kind: 'error',
        isLowContrast: false,
      });
    }

    // save encounter
    try {
      const { data: savedEncounter } = await saveEncounter(abortController, encounter, encounter.uuid);
      const savedOrders = getSavedOrderNumbers(savedEncounter);
      const savedDiagnoses = getSavedDiagnosisLabels(savedEncounter);
      if (savedOrders.length) {
        showSnackbar({
          title: t('ordersSaved', 'Order(s) saved successfully'),
          subtitle: savedOrders.join(', '),
          kind: 'success',
          isLowContrast: true,
        });
      }
      // handle diagnoses
      if (savedDiagnoses.length) {
        showSnackbar({
          title: t('diagnosisSaved', 'Diagnosis(es) saved successfully'),
          subtitle: savedDiagnoses.join(', '),
          kind: 'success',
          isLowContrast: true,
        });
      }
      // handle attachments
      try {
        const attachmentsResponse = await saveAttachments(context.formFields, savedEncounter, abortController);

        if (attachmentsResponse?.length) {
          showSnackbar({
            title: t('attachmentsSaved', 'Attachment(s) saved successfully'),
            kind: 'success',
            isLowContrast: true,
          });
        }
      } catch (error) {
        console.error('Error saving attachments', error);
        const errorMessages = extractErrorMessagesFromResponse(error);
        throw new FormSubmissionError({
          title: t('errorSavingAttachments', 'Error saving attachment(s)'),
          subtitle: errorMessages.join(', '),
          kind: 'error',
          isLowContrast: false,
        });
      }
      return savedEncounter as OpenmrsResource;
    } catch (error) {
      console.error('Error saving encounter', error);
      const errorMessages = extractErrorMessagesFromResponse(error);
      throw new FormSubmissionError({
        title: t('errorSavingEncounter', 'Error saving encounter'),
        subtitle: errorMessages.join(', '),
        kind: 'error',
        isLowContrast: false,
      });
    }
  }

  getCustomHooks(): GetCustomHooksResponse {
    return { useCustomHooks };
  }

  async getInitialValues(context: FormProcessorContextProps): Promise<FormValues> {
    const formFields = context.formFields ?? [];
    const formFieldAdapters = context.formFieldAdapters ?? {};
    const encounter = isOpenmrsEncounter(context.domainObjectValue) ? context.domainObjectValue : null;
    const initialValues: FormValues = {};
    const repeatableFields: FormField[] = [];
    if (encounter) {
      await Promise.all(
        formFields.map(async (field) => {
          const adapter = formFieldAdapters[field.type];
          if (field.meta.initialValue?.omrsObject && !isEmpty(field.meta.initialValue.refinedValue)) {
            initialValues[field.id] = field.meta.initialValue.refinedValue;
            return;
          }
          if (adapter) {
            if (hasRendering(field, 'repeating') && !field.meta?.repeat?.isClone) {
              repeatableFields.push(field);
            }
            let value: unknown = null;
            try {
              value = await adapter.getInitialValue(field, getEncounterResource(encounter), context);
              field.meta.initialValue.refinedValue = value as FormField['questionOptions']['defaultValue'];
            } catch (error) {
              console.error(error);
            }
            if (field.type === 'obsGroup') {
              return;
            }
            if (!isEmpty(value)) {
              initialValues[field.id] = value;
            } else if (!isEmpty(field.questionOptions.defaultValue)) {
              initialValues[field.id] = inferInitialValueFromDefaultFieldValue(field);
            } else {
              initialValues[field.id] = emptyValues[field.questionOptions.rendering] ?? '';
            }
            if (field.questionOptions.calculate?.calculateExpression) {
              try {
                await evaluateCalculateExpression(field, initialValues, context);
              } catch (error) {
                console.error(error);
              }
            }
          } else {
            console.warn(`No adapter found for field type ${field.type}`);
          }
        }),
      );
      const flattenedRepeatableFields = await Promise.all(
        repeatableFields.flatMap((field) => hydrateRepeatField(field, encounter, initialValues, context)),
      ).then((results) => results.flat());
      formFields.push(...flattenedRepeatableFields);
    } else {
      const filteredFields = formFields.filter(
        (field) => field.questionOptions.rendering !== 'group' && field.type !== 'obsGroup',
      );
      const fieldsWithCalculateExpressions: FormField[] = [];
      await Promise.all(
        filteredFields.map(async (field) => {
          const adapter = formFieldAdapters[field.type];
          initialValues[field.id] = emptyValues[field.questionOptions.rendering] ?? null;
          if (adapter && isEmpty(initialValues[field.id]) && contextInitializableTypes.has(field.type)) {
            try {
              const initialValue: unknown = await adapter.getInitialValue(field, getEmptySourceObject(), context);
              initialValues[field.id] = initialValue;
            } catch (error) {
              console.error(error);
            }
          }
          if (field.questionOptions.defaultValue) {
            initialValues[field.id] = inferInitialValueFromDefaultFieldValue(field);
          }
          if (field.questionOptions.calculate?.calculateExpression) {
            fieldsWithCalculateExpressions.push(field);
          }
        }),
      );
      await Promise.all(
        fieldsWithCalculateExpressions.map(async (field) => {
          try {
            await evaluateCalculateExpression(field, initialValues, context);
          } catch (error) {
            console.error(error);
          }
        }),
      );
    }
    return initialValues;
  }

  async loadDependencies(
    context: Partial<FormProcessorContextProps>,
    setContext: React.Dispatch<React.SetStateAction<FormProcessorContextProps>>,
  ): Promise<Record<string, unknown>> {
    const patientId = context.patient?.id;
    const encounterType = context.formJson?.encounterType;
    const encounter = patientId && encounterType ? await getPreviousEncounter(patientId, encounterType) : null;
    const previousEncounterUuid = isOpenmrsEncounter(context.previousDomainObjectValue)
      ? context.previousDomainObjectValue.uuid
      : null;
    const nextEncounterUuid = encounter?.uuid ?? null;

    if (previousEncounterUuid === nextEncounterUuid) {
      return {};
    }

    setContext((context) => {
      const currentPreviousEncounterUuid = isOpenmrsEncounter(context.previousDomainObjectValue)
        ? context.previousDomainObjectValue.uuid
        : null;

      if (currentPreviousEncounterUuid === nextEncounterUuid) {
        return context;
      }

      return {
        ...context,
        previousDomainObjectValue: encounter ? (encounter as unknown as OpenmrsResource) : undefined,
      };
    });
    return {};
  }

  async getHistoricalValue(field: FormField, context: FormContextProps): Promise<ValueAndDisplay> {
    const {
      formFields,
      sessionMode,
      patient,
      methods: { getValues },
      formFieldAdapters,
      previousDomainObjectValue,
      visit,
    } = context;
    const node: FormNode = { value: field, type: 'field' };
    const adapter = formFieldAdapters[field.type];
    if (field.historicalExpression) {
      const value: unknown = await evaluateAsyncExpression(
        field.historicalExpression,
        node,
        formFields,
        getFormValues(getValues()),
        {
          mode: sessionMode,
          patient,
          previousEncounter: previousDomainObjectValue,
          visit,
        },
      );
      return isHistoricalValue(value) ? extractObsValueAndDisplay(field, value) : null;
    }
    if (previousDomainObjectValue && field.questionOptions.enablePreviousValue) {
      return await adapter.getPreviousValue(field, previousDomainObjectValue, context);
    }
    return null;
  }
}

async function evaluateCalculateExpression(
  field: FormField,
  values: FormValues,
  formContext: FormProcessorContextProps,
): Promise<void> {
  const { formFields, sessionMode, patient, visit } = formContext;
  const expression = field.questionOptions.calculate.calculateExpression;
  const node: FormNode = { value: field, type: 'field' };
  const context = {
    mode: sessionMode,
    patient: patient,
    visit,
  };
  const value: unknown = await evaluateAsyncExpression(expression, node, formFields, values, context);
  if (!isEmpty(value)) {
    values[field.id] = value;
  }
}

/**
 * Validates calculate expressions to warn about common mistakes.
 * Specifically, checks if string literals in expressions match field IDs,
 * which usually indicates the user should use bare variable references instead.
 *
 * For example: calcEDD('lmp') should be calcEDD(lmp)
 */
function validateCalculateExpressions(schema: FormSchema, allFieldIds: Set<string>): void {
  const stringLiteralPattern = /(['"])([a-zA-Z_][a-zA-Z0-9_]*)\1/g;

  function checkExpression(expression: string, fieldId: string): void {
    for (const match of expression.matchAll(stringLiteralPattern)) {
      const quotedValue = match[2];
      if (allFieldIds.has(quotedValue)) {
        console.error(
          `The calculateExpression for the field '${fieldId}' incorrectly quotes the field ID '${quotedValue}' as a string. ` +
            `Field IDs must be referenced as variables without quotes to access their values. ` +
            `Remove the quotes: use ${quotedValue} instead of '${quotedValue}'.`,
        );
      }
    }
  }

  function processField(field: FormField): void {
    if (field.questionOptions?.calculate?.calculateExpression) {
      checkExpression(field.questionOptions.calculate.calculateExpression, field.id);
    }
    // Process nested questions (for obsGroups)
    if (field.questions) {
      field.questions.forEach(processField);
    }
  }

  schema.pages.forEach((page) => {
    page.sections.forEach((section) => {
      section.questions.forEach(processField);
    });
  });
}

function getSavedOrderNumbers(encounter: OpenmrsEncounter): string[] {
  return (encounter.orders ?? [])
    .map((order) => order.orderNumber)
    .filter((orderNumber): orderNumber is string => isStringValue(orderNumber));
}

function getSavedDiagnosisLabels(encounter: OpenmrsEncounter): string[] {
  return (encounter.diagnoses ?? [])
    .map((diagnosis) => ('display' in diagnosis && isStringValue(diagnosis.display) ? diagnosis.display : null))
    .filter((display): display is string => isStringValue(display));
}

function asPatientPrograms(value: unknown): PatientProgram[] {
  return Array.isArray(value) ? value.filter(isPatientProgram) : [];
}

function isPatientProgram(value: unknown): value is PatientProgram {
  return isPlainObject(value);
}

function isOpenmrsEncounter(value: unknown): value is OpenmrsEncounter {
  return isPlainObject(value);
}

function getFormValues(value: unknown): FormValues {
  return isPlainObject(value) ? value : {};
}

function isHistoricalValue(value: unknown): value is Parameters<typeof extractObsValueAndDisplay>[1] {
  return value == null || typeof value === 'string' || typeof value === 'number' || isPlainObject(value);
}

function getEncounterResource(encounter: OpenmrsEncounter): OpenmrsResource {
  return encounter as unknown as OpenmrsResource;
}

function getEmptySourceObject(): OpenmrsResource {
  return {} as OpenmrsResource;
}
