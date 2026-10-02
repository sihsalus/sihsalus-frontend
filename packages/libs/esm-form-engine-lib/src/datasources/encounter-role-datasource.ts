import { type OpenmrsResource, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework/src/internal';
import { BaseOpenMRSDataSource } from './data-source';

interface ResultsResponse<T> {
  results?: T[];
  links?: Array<{ rel?: string }>;
}

const encounterRoleRepresentation = 'v=custom:(uuid,display,name)';

export class EncounterRoleDataSource extends BaseOpenMRSDataSource {
  constructor() {
    super(`${restBaseUrl}/encounterrole?${encounterRoleRepresentation}`);
  }

  async fetchData(searchTerm: string, _config?: Record<string, unknown>): Promise<OpenmrsResource[]> {
    // REST's encounter-role search matches the complete name, unlike other
    // searchable metadata. Filter the active catalog so partial names work.
    const roles: OpenmrsResource[] = [];
    const seen = new Set<string>();
    let hasNext: boolean;
    do {
      const { data } = await openmrsFetch<ResultsResponse<OpenmrsResource>>(`${this.url}&startIndex=${roles.length}`);
      const page = data.results ?? [];
      hasNext = data.links?.some(({ rel }) => rel === 'next') ?? false;
      if (hasNext && page.length === 0) {
        throw new Error('Unable to load the encounter role catalog.');
      }
      for (const { uuid } of page) {
        if (!uuid || seen.has(uuid)) throw new Error('Unable to load the encounter role catalog.');
        seen.add(uuid);
      }
      roles.push(...page);
    } while (hasNext);

    const query = searchTerm?.trim().toLocaleLowerCase();
    return query ? roles.filter(({ display }) => display?.toLocaleLowerCase().includes(query)) : roles;
  }
}
