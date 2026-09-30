import { clearCurrentUser, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { mutate } from 'swr';

export async function performLogout() {
  await openmrsFetch(`${restBaseUrl}/session`, {
    method: 'DELETE',
  });

  // clear the SWR cache on logout, do not revalidate
  // taken from the SWR docs
  mutate(() => true, undefined, { revalidate: false });

  clearCurrentUser();
}
