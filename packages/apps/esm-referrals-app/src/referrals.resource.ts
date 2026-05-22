import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { CommunityReferral } from './types';

export function useCommunityReferrals(status: string) {
  const url = `${restBaseUrl}/kenyaemril/communityReferrals?status=${status}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Array<CommunityReferral> }>(
    url,
    openmrsFetch,
  );

  return {
    referrals: data?.data ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

export function processCommunityReferral(id: number) {
  return openmrsFetch<{ uuid: string }>(`${restBaseUrl}/kenyaemril/serveReferredClient`, {
    method: 'POST',
    body: { referralMessageId: id },
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function pullFacilityReferrals() {
  return openmrsFetch(`${restBaseUrl}/kenyaemril/pullShrReferrals`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
