import { openmrsFetch } from '@openmrs/esm-framework';

export interface LabsetMember {
  uuid: string;
  display: string;
  setMembers?: Array<LabsetMember>;
}

export interface LabsetResponse extends LabsetMember {
  setMembers: Array<LabsetMember>;
}

interface FetchFailure {
  response?: {
    status?: number;
  };
}

/**
 * Fetch configured lab sets without making one stale UUID disable every
 * otherwise valid filter option. Server and connectivity failures still fail
 * the request so that they are not silently presented as an empty config.
 */
export async function fetchConfiguredLabsets(urls: Array<string>): Promise<Array<LabsetResponse>> {
  const results = await Promise.allSettled(
    urls.map((url) => openmrsFetch<LabsetResponse>(url).then((response) => response.data)),
  );

  const fatalFailure = results.find(
    (result) => result.status === 'rejected' && (result.reason as FetchFailure)?.response?.status !== 404,
  );
  if (fatalFailure?.status === 'rejected') {
    throw fatalFailure.reason;
  }

  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}
