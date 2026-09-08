import { useEffect, useMemo, useState } from 'react';
import { fetchClobData, fetchOpenMRSForm } from '../api';
import { formEngineAppName } from '../globals';
import { getRegisteredFormSchemaTransformers } from '../registry/registry';
import {
  type FormReference,
  type FormSchema,
  type FormSchemaTransformer,
  type FormSection,
  type PreFilledQuestions,
  type ReferencedForm,
} from '../types';
import { isTrue } from '../utils/boolean-utils';
import { isPlainObject } from '../utils/common-utils';
import { applyFormIntent } from '../utils/forms-loader';

export function useFormJson(
  formUuid: string,
  rawFormJson: unknown,
  encounterUuid: string,
  formSessionIntent: string,
  preFilledQuestions?: PreFilledQuestions,
): {
  formJson: FormSchema | null;
  isLoading: boolean;
  formError: Error | undefined;
} {
  // Wrappers can normalize the same cached schema into a new object on render.
  // A logical session change must hide old data immediately; an equivalent
  // object must not unmount a dirty form merely because its reference changed.
  const rawFormIdentity =
    isPlainObject(rawFormJson) && typeof rawFormJson.uuid === 'string' && rawFormJson.uuid
      ? rawFormJson.uuid
      : rawFormJson;
  const session = useMemo(
    () => ({ formUuid, rawFormIdentity, encounterUuid, formSessionIntent }),
    [formUuid, rawFormIdentity, encounterUuid, formSessionIntent],
  );
  const argsError = useMemo(() => validateFormsArgs(formUuid, rawFormJson), [formUuid, rawFormJson]);
  const [loaded, setLoaded] = useState<{
    session: object;
    formJson: FormSchema | null;
    error: Error | undefined;
  }>(() => ({ session, formJson: null, error: argsError }));

  useEffect(() => {
    let disposed = false;

    const setFormJsonWithTranslations = (nextFormJson: FormSchema): void => {
      if (disposed) {
        return;
      }
      if (nextFormJson.translations) {
        const language = window.i18next.language;
        window.i18next.addResourceBundle(language, formEngineAppName, nextFormJson.translations, true, true);
      }
      setLoaded({ session, formJson: nextFormJson, error: undefined });
    };

    setLoaded((previous) => {
      if (previous.session === session && previous.error === argsError) {
        return previous;
      }
      return {
        session,
        formJson: !argsError && previous.session === session ? previous.formJson : null,
        error: argsError,
      };
    });

    if (argsError) {
      return;
    }

    void loadFormJson(formUuid, rawFormJson, formSessionIntent, preFilledQuestions)
      .then((loadedFormJson) => {
        setFormJsonWithTranslations({
          ...loadedFormJson,
          encounter: encounterUuid,
        });
      })
      .catch(() => {
        if (!disposed) {
          console.error('Failed to load form schema.');
          setLoaded({
            session,
            formJson: null,
            error: new Error('Error loading form JSON'),
          });
        }
      });

    return (): void => {
      disposed = true;
    };
  }, [argsError, encounterUuid, formSessionIntent, formUuid, preFilledQuestions, rawFormJson, session]);

  const current = loaded.session === session && !argsError ? loaded : { formJson: null, error: argsError };

  return {
    formJson: current.formJson,
    isLoading: !current.formJson && !current.error,
    formError: current.error,
  };
}

/**
 * Fetches a form JSON schema from OpenMRS and recursively fetches its subForms if they available.
 *
 * If `rawFormJson` is provided, it will be used as the raw form JSON object. Otherwise, the form JSON will be fetched from OpenMRS using the `formIdentifier` parameter.
 *
 * @param rawFormJson The raw form JSON object to be used if `formIdentifier` is not provided.
 * @param formIdentifier The UUID or name of the form to be fetched from OpenMRS if `rawFormJson` is not provided.
 * @param formSessionIntent An optional parameter that represents the current intent.
 * @param preFilledQuestions An optional parameter that represents the pre-filled questions.
 * @returns A well-built form object that might include subForms.
 */
export async function loadFormJson(
  formIdentifier: string,
  rawFormJson?: unknown,
  formSessionIntent?: string,
  preFilledQuestions?: PreFilledQuestions,
): Promise<FormSchema> {
  const openmrsFormResponse = formIdentifier ? await fetchOpenMRSForm(formIdentifier) : null;
  const clobDataResponse = openmrsFormResponse ? await fetchClobData(openmrsFormResponse) : null;
  const transformers = await getRegisteredFormSchemaTransformers();
  const formJson: FormSchema = clobDataResponse
    ? { ...clobDataResponse, uuid: openmrsFormResponse?.uuid ?? clobDataResponse.uuid }
    : parseFormJson(rawFormJson);

  // Sub forms
  const subFormRefs = extractSubFormRefs(formJson);
  const subForms = await loadSubForms(subFormRefs, formSessionIntent);
  updateFormJsonWithSubForms(formJson, subForms);

  // Form components
  const formComponentsRefs = getReferencedForms(formJson);
  const resolvedFormComponents = await loadFormComponents(formComponentsRefs);
  const formNameToAliasMap = formComponentsRefs.reduce<Record<string, string>>((acc, form) => {
    acc[form.formName] = form.alias;
    return acc;
  }, {});

  const formComponents = mapFormComponents(resolvedFormComponents);
  updateFormJsonWithComponents(formJson, formComponents, formNameToAliasMap);
  return refineFormJson(formJson, transformers, formSessionIntent, preFilledQuestions);
}

function extractSubFormRefs(formJson: FormSchema): string[] {
  return formJson.pages
    .filter((page) => page.isSubform && !page.subform.form && page.subform?.name)
    .map((page) => page.subform?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

async function loadSubForms(subFormRefs: string[], formSessionIntent?: string): Promise<FormSchema[]> {
  return Promise.all(subFormRefs.map((subForm) => loadFormJson(subForm, undefined, formSessionIntent)));
}

function updateFormJsonWithSubForms(formJson: FormSchema, subForms: FormSchema[]): void {
  subForms.forEach((subForm) => {
    const matchingPage = formJson.pages.find((page) => page.subform?.name === subForm.name);
    if (matchingPage) {
      matchingPage.subform.form = subForm;
    }
  });
}

function validateFormsArgs(formUuid: string, rawFormJson: unknown): Error | undefined {
  if (!formUuid && !rawFormJson) {
    return new Error('InvalidArgumentsErr: Neither formUuid nor formJson was provided');
  }
  if (formUuid && rawFormJson) {
    return new Error('InvalidArgumentsErr: Both formUuid and formJson cannot be provided at the same time.');
  }
}

/**
 * Refines the input form JSON object by parsing it, removing inline sub forms, applying form schema transformers, setting the encounter type, and applying form intents if provided.
 * @param {any} formJson - The input form JSON object or string.
 * @param {string} [formSessionIntent] - The optional form session intent.
 * @param {PreFilledQuestions} [preFilledQuestions] - The optional pre-filled questions.
 * @returns {FormSchema} - The refined form JSON object of type FormSchema.
 */
function refineFormJson(
  formJson: FormSchema,
  schemaTransformers: FormSchemaTransformer[] = [],
  formSessionIntent?: string,
  preFilledQuestions?: PreFilledQuestions,
): FormSchema {
  removeInlineSubForms(formJson, formSessionIntent);
  // apply form schema transformers
  const transformedForm = schemaTransformers.reduce(
    (draftForm, transformer) => transformer.transform(draftForm, preFilledQuestions),
    formJson,
  );
  setEncounterType(transformedForm);
  return applyFormIntent(formSessionIntent, transformedForm);
}

/**
 * Parses the input form JSON and returns a deep copy of the object.
 * @param {any} formJson - The input form JSON object or string.
 * @returns {FormSchema} - The parsed form JSON object of type FormSchema.
 */
function parseFormJson(formJson: unknown): FormSchema {
  const parsedFormJson: unknown =
    typeof formJson === 'string' ? JSON.parse(formJson) : JSON.parse(JSON.stringify(formJson));

  if (isFormSchema(parsedFormJson)) {
    return parsedFormJson;
  }

  throw new Error('Invalid form JSON payload');
}

/**
 * Removes inline sub forms from the form JSON and replaces them with their pages if the encounter type matches.
 * @param {FormSchema} formJson - The input form JSON object of type FormSchema.
 * @param {string} formSessionIntent - The form session intent.
 */
function removeInlineSubForms(formJson: FormSchema, formSessionIntent: string): void {
  for (let i = formJson.pages.length - 1; i >= 0; i--) {
    const page = formJson.pages[i];
    if (
      isTrue(page.isSubform) &&
      !isTrue(page.isHidden) &&
      page.subform?.form?.encounterType === formJson.encounterType
    ) {
      formJson.pages.splice(i, 1, ...refineFormJson(page.subform.form, [], formSessionIntent).pages);
    }
  }
}

/**
 * Sets the encounter type for the form JSON if it's provided through the `encounter` attribute.
 * @param {FormSchema} formJson - The input form JSON object of type FormSchema.
 */
function setEncounterType(formJson: FormSchema): void {
  if (formJson.encounter && typeof formJson.encounter === 'string' && !formJson.encounterType) {
    formJson.encounterType = formJson.encounter;
    delete formJson.encounter;
  }
}

/**
 * Functions to support reusable Form Components
 */
function getReferencedForms(formJson: FormSchema): Array<ReferencedForm> {
  return Array.isArray(formJson.referencedForms) ? formJson.referencedForms : [];
}

async function loadFormComponents(formComponentRefs: Array<ReferencedForm>): Promise<FormSchema[]> {
  return Promise.all(
    formComponentRefs.map((formComponent) => loadFormJson(formComponent.formName, undefined, undefined)),
  );
}

function mapFormComponents(formComponents: Array<FormSchema>): Map<string, FormSchema> {
  const formComponentsMap: Map<string, FormSchema> = new Map();

  formComponents.forEach((formComponent) => {
    formComponentsMap.set(formComponent.name, formComponent);
  });

  return formComponentsMap;
}

function updateFormJsonWithComponents(
  formJson: FormSchema,
  formComponents: Map<string, FormSchema>,
  formNameToAliasMap: Record<string, string>,
): void {
  formComponents.forEach((component, targetFormName) => {
    //loop through pages and search sections for reference key
    formJson.pages.forEach((page) => {
      if (page.sections) {
        page.sections.forEach((section) => {
          if (
            section.reference &&
            (section.reference.form === targetFormName || section.reference.form === formNameToAliasMap[targetFormName])
          ) {
            // resolve referenced component section
            const resolvedFormSection = getReferencedFormSection(section, component);
            // add resulting referenced component section to section
            Object.assign(section, resolvedFormSection);
          }
        });
      }
    });
  });
}

function getReferencedFormSection(formSection: FormSection, formComponent: FormSchema): FormSection {
  let referencedFormSection: FormSection | undefined;

  // search for component page and section reference from component
  const reference = formSection.reference;
  if (!reference) {
    return formSection;
  }

  const matchingComponentPage = formComponent.pages.filter((page) => page.label === reference.page);
  if (matchingComponentPage.length > 0) {
    const matchingComponentSection = matchingComponentPage[0].sections.filter(
      (componentSection) => componentSection.label === reference.section,
    );
    if (matchingComponentSection.length > 0) {
      referencedFormSection = matchingComponentSection[0];
    }
  }

  return filterExcludedQuestions(referencedFormSection ?? formSection, reference);
}

function filterExcludedQuestions(formSection: FormSection, reference: FormReference): FormSection {
  if (reference?.excludeQuestions) {
    const excludeQuestions = reference.excludeQuestions;
    formSection.questions = formSection.questions.filter((question) => {
      return !excludeQuestions.includes(question.id);
    });
  }
  return formSection;
}

function isFormSchema(value: unknown): value is FormSchema {
  return (
    isPlainObject(value) &&
    typeof value.name === 'string' &&
    typeof value.processor === 'string' &&
    typeof value.uuid === 'string' &&
    Array.isArray(value.pages) &&
    Array.isArray(value.referencedForms)
  );
}
