import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type FormSchema } from '@sihsalus/esm-form-engine-lib';
import useSWR from 'swr';
import { type ConfigObject, defaultLegacyConceptCompatibilityMap } from '../config-schema';

interface FormSchemaResponse {
  data: FormSchema;
}

interface UseFormSchemaResult {
  schema: FormSchema | null;
  error: Error | undefined;
  isLoading: boolean;
}

type FormField = FormSchema['pages'][number]['sections'][number]['questions'][number];

function normalizeField(field: FormField, conceptCompatibilityMap: Record<string, string>): FormField {
  const nextField = { ...field, questionOptions: { ...field.questionOptions } };
  const concept = nextField.questionOptions.concept;

  if (concept && conceptCompatibilityMap[concept]) {
    nextField.questionOptions.concept = conceptCompatibilityMap[concept];
  }

  if (nextField.questionOptions.answers?.length) {
    nextField.questionOptions.answers = nextField.questionOptions.answers.map((answer) => ({
      ...answer,
      concept: conceptCompatibilityMap[answer.concept] ?? answer.concept,
    }));
  }

  if (nextField.questions?.length) {
    nextField.questions = nextField.questions.map((question) => normalizeField(question, conceptCompatibilityMap));
  }

  return nextField;
}

export function normalizeSchema(
  schema: FormSchema,
  conceptCompatibilityMap: Record<string, string> = defaultLegacyConceptCompatibilityMap,
): FormSchema {
  return {
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => normalizeField(question, conceptCompatibilityMap)),
      })),
      subform: page.subform
        ? {
            ...page.subform,
            form: normalizeSchema(page.subform.form, conceptCompatibilityMap),
          }
        : page.subform,
    })),
  };
}

/**
 * Custom hook to fetch form schema based on its form UUID.
 *
 * @param formUuid - The UUID of the form to retrieve the schema for
 * @returns An object containing the form schema, error, and loading state
 */
const useFormSchema = (formUuid: string): UseFormSchemaResult => {
  const config = useConfig<ConfigObject>();
  const conceptCompatibilityMap = config?.legacyConceptCompatibilityMap ?? defaultLegacyConceptCompatibilityMap;
  const url = formUuid ? `${restBaseUrl}/o3/forms/${formUuid}` : null;

  const { data, error, isLoading } = useSWR<FormSchemaResponse, Error>(url, openmrsFetch);
  const formSchema = data?.data;
  const schema = formSchema ? normalizeSchema(formSchema, conceptCompatibilityMap) : null;

  return { schema, error, isLoading };
};

export default useFormSchema;
