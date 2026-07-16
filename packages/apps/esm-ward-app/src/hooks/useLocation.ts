import { type FetchResponse, type Location, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

export default function useLocation(
  locationUuid: string | null,
  rep: string = 'custom:(display,uuid,tags:(uuid,display))',
) {
  return useSWRImmutable<FetchResponse<Location>>(
    locationUuid ? `${restBaseUrl}/location/${locationUuid}?v=${rep}` : null,
    openmrsFetch,
  );
}
