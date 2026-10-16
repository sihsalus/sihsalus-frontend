import { makeUrl, openmrsFetch, restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';

export interface MotherAndChildLink {
  mother: { uuid: string; display?: string };
  child: { uuid: string; display?: string };
}

export interface MotherAndChildLinkQuery {
  motherUuid?: string;
  childUuid?: string;
}

/** Reads explicit EmrApi relationships across visits; never reconstructs family links from observations. */
export function useMotherAndChildLinks(query: MotherAndChildLinkQuery, enabled: boolean) {
  const motherUuid = query.motherUuid?.trim();
  const childUuid = query.childUuid?.trim();
  const url = new URL(makeUrl(`${restBaseUrl}/emrapi/maternal/mothersAndChildren`), window.location.toString());
  if (motherUuid) url.searchParams.set('mother', motherUuid);
  if (childUuid) url.searchParams.set('child', childUuid);
  url.searchParams.set('requireMotherHasActiveVisit', 'false');
  url.searchParams.set('requireChildHasActiveVisit', 'false');
  url.searchParams.set('requireChildBornDuringMothersActiveVisit', 'false');
  url.searchParams.set('v', 'custom:(mother:(uuid,display),child:(uuid,display))');

  return useOpenmrsFetchAll<MotherAndChildLink>(enabled && (motherUuid || childUuid) ? url : '', {
    fetcher: openmrsFetch,
    swrInfiniteConfig: { keepPreviousData: false, shouldRetryOnError: false },
  });
}
