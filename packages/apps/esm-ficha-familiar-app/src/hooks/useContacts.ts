import { formatDate, openmrsFetch, parseDate, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { BOOLEAN_YES } from '../contact-list/contact-list.resource';
import type { Contact, Person, Relationship } from '../types';

function extractValue(display: string) {
  const pattern = /=\s*(.*)$/;
  const match = display.match(pattern);
  if (match && match.length > 1) {
    return match[1].trim();
  }
  return display.trim();
}

function extractAttributeData(person: Person, config: ConfigObject) {
  const attributeData: {
    contact: string | null;
    baselineHIVStatus: string | null;
    personContactCreated: string | null;
    pnsAproach: string | null;
    livingWithClient: string | null;
    ipvOutcome: string | null;
    dataConsent: boolean | null;
  } = {
    contact: null,
    baselineHIVStatus: null,
    personContactCreated: null,
    pnsAproach: null,
    livingWithClient: null,
    ipvOutcome: null,
    dataConsent: null,
  };

  for (const attr of person.attributes) {
    if (attr.attributeType.uuid === config.contactPersonAttributesUuid.telephone) {
      attributeData.contact = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.baselineHIVStatus) {
      attributeData.baselineHIVStatus = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.contactCreated) {
      attributeData.personContactCreated = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.livingWithContact) {
      attributeData.livingWithClient = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.preferedPnsAproach) {
      attributeData.pnsAproach = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.contactipvOutcome) {
      attributeData.ipvOutcome = attr.display ? extractValue(attr.display) : null;
    } else if (attr.attributeType.uuid === config.contactPersonAttributesUuid.dataConsent) {
      attributeData.dataConsent = attr.value === BOOLEAN_YES || attr.value === 'true';
    }
  }

  return attributeData;
}

function getContact(relationship: Relationship, config: ConfigObject, person: 'personA' | 'personB') {
  return {
    ...extractAttributeData(relationship[person], config),
    uuid: relationship.uuid,
    name: relationship[person].display,
    display: relationship[person].display,
    relativeAge: relationship[person].age,
    dead: relationship[person].dead,
    causeOfDeath: relationship[person].causeOfDeath,
    relativeUuid: relationship[person].uuid,
    relationshipType: relationship.relationshipType.bIsToA,
    patientUuid: relationship[person].uuid,
    gender: relationship[person].gender,
    startDate: !relationship.startDate ? null : formatDate(parseDate(relationship.startDate)),
    age: relationship[person].age,
    endDate: !relationship.endDate ? null : formatDate(parseDate(relationship.endDate)),
  } as Contact;
}
function extractContactData(
  patientIdentifier: string,
  relationships: Array<Relationship>,
  config: ConfigObject,
): Array<Contact> {
  const relationshipsData: Contact[] = [];
  for (const r of relationships) {
    if (patientIdentifier === r.personA.uuid) {
      relationshipsData.push(getContact(r, config, 'personB'));
    } else {
      relationshipsData.push(getContact(r, config, 'personA'));
    }
  }
  return relationshipsData;
}

const useContacts = (patientUuid: string) => {
  const customeRepresentation =
    'custom:(display,uuid,personA:(uuid,age,display,dead,causeOfDeath,gender,attributes:(uuid,display,value,attributeType:(uuid,display))),personB:(uuid,age,display,dead,causeOfDeath,gender,attributes:(uuid,display,value,attributeType:(uuid,display))),relationshipType:(uuid,display,description,aIsToB,bIsToA),startDate)';
  const url = `/ws/rest/v1/relationship?v=${customeRepresentation}&person=${patientUuid}`;
  const config = useConfig<ConfigObject>();
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Relationship[] } }, Error>(
    url,
    openmrsFetch,
  );
  const relationships = useMemo(() => {
    return data?.data?.results?.length
      ? extractContactData(
          patientUuid,
          data?.data?.results.filter((rel) =>
            config.pnsRelationships.some((famRel) => famRel.uuid === rel.relationshipType.uuid),
          ),
          config,
        )
      : [];
  }, [data?.data?.results, patientUuid, config]);
  return {
    contacts: relationships,
    error,
    isLoading,
    isValidating,
    mutate,
  };
};

export default useContacts;
