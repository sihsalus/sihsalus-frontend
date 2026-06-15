import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

interface VisitAttributeType {
  uuid: string;
  display: string;
  name: string;
  description: string | null;
  datatypeClassname:
    | 'org.openmrs.customdatatype.datatype.ConceptDatatype'
    | 'org.openmrs.customdatatype.datatype.FloatDatatype'
    | 'org.openmrs.customdatatype.datatype.BooleanDatatype'
    | 'org.openmrs.customdatatype.datatype.LongFreeTextDatatype'
    | 'org.openmrs.customdatatype.datatype.FreeTextDatatype'
    | 'org.openmrs.customdatatype.datatype.DateDatatype';
  datatypeConfig: string;
  preferredHandlerClassname?: string;
  retired: boolean;
}

interface Concept {
  uuid: string;
  name: {
    display: string;
  };
  display: string;
  answers: Array<{
    display: string;
    uuid: string;
  }>;
}

const visitAttributeTypeCustomRepresentation =
  'custom:(uuid,display,name,description,datatypeClassname,datatypeConfig)';

export function useVisitAttributeTypes() {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<{ results: VisitAttributeType[] }>, Error>(
    `${restBaseUrl}/visitattributetype?v=${visitAttributeTypeCustomRepresentation}`,
    openmrsFetch,
  );

  if (error) {
    console.error('Failed to fetch visit attribute types: ', error);
  }

  const results = useMemo(
    () => ({
      isLoading,
      error,
      visitAttributeTypes: data?.data?.results ?? [],
    }),
    [data, error, isLoading],
  );

  return results;
}

export function useVisitAttributeType(uuid?: string) {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<VisitAttributeType>, Error>(
    `${restBaseUrl}/visitattributetype/${uuid}?v=${visitAttributeTypeCustomRepresentation}`,
    openmrsFetch,
  );

  if (error) {
    console.error(`Failed to fetch visit attribute type ${uuid}: `, error);
  }

  const results = useMemo(
    () => ({
      isLoading,
      error: error,
      data: data?.data,
    }),
    [data, error, isLoading],
  );

  return results;
}

export function useConceptAnswersForVisitAttributeType(conceptUuid?: string) {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<Concept>, Error>(
    conceptUuid ? `${restBaseUrl}/concept/${conceptUuid}` : null,
    openmrsFetch,
  );

  if (error) {
    console.error(`Failed to fetch concept answers for visit attribute type ${conceptUuid}: `, error);
  }

  const results = useMemo(
    () => ({
      isLoading,
      error: error,
      data: data?.data,
      answers: data?.data?.answers,
    }),
    [data, error, isLoading],
  );

  return results;
}

export function useConceptDisplay(conceptUuid?: string) {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<Pick<Concept, 'uuid' | 'display'>>, Error>(
    conceptUuid ? `${restBaseUrl}/concept/${conceptUuid}?v=custom:(uuid,display)` : null,
    openmrsFetch,
  );

  if (error) {
    console.error(`Failed to fetch concept display ${conceptUuid}: `, error);
  }

  return useMemo(
    () => ({
      isLoading,
      error,
      display: data?.data?.display,
    }),
    [data, error, isLoading],
  );
}
