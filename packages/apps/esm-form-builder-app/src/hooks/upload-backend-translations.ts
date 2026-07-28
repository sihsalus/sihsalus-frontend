import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Resource } from '@types';

export async function uploadBackendTranslations(
  formUuid: string,
  langCode: string,
  formName: string,
  translations: Record<string, string>,
): Promise<void> {
  try {
    const formResponse = await openmrsFetch<{ resources?: Array<Resource> }>(`${restBaseUrl}/form/${formUuid}?v=full`);
    const formResources: Resource[] = Array.isArray(formResponse.data.resources) ? formResponse.data.resources : [];

    const resourceName = `${formName}_translations_${langCode}`;
    const existingResource = formResources.find((resource) => resource.name === resourceName);

    if (existingResource) {
      await openmrsFetch(`${restBaseUrl}/form/${formUuid}/resource/${existingResource.uuid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (existingResource.valueReference) {
        await openmrsFetch(`${restBaseUrl}/clobdata/${existingResource.valueReference}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const translationBlob = new Blob([JSON.stringify({ translations })], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', translationBlob);

    const clobResponse = await globalThis.fetch(`${globalThis.openmrsBase}${restBaseUrl}/clobdata`, {
      method: 'POST',
      body: formData,
    });

    const newClobdataUuid = await clobResponse.text();
    if (!newClobdataUuid) throw new Error('Failed to create new clobdata');

    await openmrsFetch(`${restBaseUrl}/form/${formUuid}/resource`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: resourceName,
        valueReference: newClobdataUuid,
      }),
    });
  } catch (error) {
    console.error('Error uploading backend translations:', error);
    throw error;
  }
}
