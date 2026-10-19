import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Form } from './types';

type FormResponse = Partial<Form> & { uuid: string };
interface FormSearchResponse {
  results?: Array<FormResponse>;
  links?: Array<{ rel?: string }>;
}

export interface PublishedFormOptions {
  version?: string;
  name?: string;
  fallbackDisplay?: string;
  formCategory?: string;
}

const representation = '(uuid,name,display,version,published,retired,resources:(uuid,name,dataType,valueReference))';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalize = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Resolves one current published REST Form; never substitutes an ambiguous or incomplete search. */
export async function resolvePublishedForm(identifier: string, options: PublishedFormOptions = {}): Promise<Form> {
  const key = identifier.trim();
  if (!key) throw new Error('Form identifier is empty');
  const verified = (form?: FormResponse): form is FormResponse =>
    Boolean(
      form?.uuid &&
        form.published === true &&
        form.retired === false &&
        (!options.version || form.version === options.version) &&
        (!options.name || normalize(form.name) === normalize(options.name)),
    );
  let form: FormResponse | undefined;
  if (uuidPattern.test(key)) {
    const response = await openmrsFetch<FormResponse>(`${restBaseUrl}/form/${key}?v=custom:${representation}`, {
      cache: 'no-store',
    });
    if (!verified(response.data) || normalize(response.data.uuid) !== normalize(key)) {
      throw new Error('The configured form is unavailable');
    }
    form = response.data;
  } else {
    const params = new URLSearchParams({
      q: key,
      v: `custom:${representation}`,
    });
    const response = await openmrsFetch<FormSearchResponse>(`${restBaseUrl}/form?${params}`, { cache: 'no-store' });
    if (!Array.isArray(response.data?.results) || response.data.links?.some(({ rel }) => rel === 'next')) {
      throw new Error('The configured form search could not be verified');
    }
    const matches = response.data.results.filter(
      (candidate) =>
        verified(candidate) &&
        [candidate.uuid, candidate.name, candidate.display].some((value) => normalize(value) === normalize(key)),
    );
    if (matches.length !== 1) throw new Error('The configured published form could not be resolved uniquely');
    form = matches[0];
  }
  const display = form.display ?? form.name ?? options.fallbackDisplay ?? key;
  return {
    uuid: form.uuid,
    name: form.name ?? display,
    display,
    version: form.version ?? '1.0',
    published: true,
    retired: false,
    resources: form.resources ?? [],
    formCategory: form.formCategory ?? options.formCategory,
  };
}
