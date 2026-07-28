import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface FormResource {
  uuid: string;
  name?: string;
  valueReference?: string;
}

export async function fetchBackendTranslations(
  formUuid: string,
  langCode: string,
  fallbackStrings: Record<string, string>,
): Promise<Record<string, string>> {
  try {
    const formUrl = `${restBaseUrl}/form/${formUuid}?v=full`;
    const formResponse = await openmrsFetch<{ resources?: Array<FormResource> }>(formUrl);
    const resources: FormResource[] = Array.isArray(formResponse.data.resources) ? formResponse.data.resources : [];

    const translationResource = resources.find((r) => r.name?.endsWith(`translations_${langCode}`));

    if (!translationResource?.valueReference) return fallbackStrings;

    const clobUrl = `${restBaseUrl}/clobdata/${translationResource.valueReference}`;
    const clobResponse = await openmrsFetch<{ translations?: Record<string, string> }>(clobUrl);
    const backendTranslations = clobResponse.data.translations ?? {};

    // Merge only existing keys
    return Object.entries(fallbackStrings).reduce(
      (acc, [key, value]) => {
        acc[key] = backendTranslations[key] ?? value;
        return acc;
      },
      {} as Record<string, string>,
    );
  } catch (error) {
    console.error('Error fetching backend translations:', error);
    return fallbackStrings;
  }
}
