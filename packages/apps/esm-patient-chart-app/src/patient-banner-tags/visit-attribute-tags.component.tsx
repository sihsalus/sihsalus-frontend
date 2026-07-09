import { Tag } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import React from 'react';

import { type ChartConfig } from '../config-schema';

interface VisitAttributeTagsProps {
  patientUuid: string;
}

const getAttributeValue = (attributeType, value) => {
  switch (attributeType?.datatypeClassname) {
    case 'org.openmrs.customdatatype.datatype.ConceptDatatype':
      return value?.display;
    case 'org.openmrs.customdatatype.datatype.FloatDatatype':
    case 'org.openmrs.customdatatype.datatype.FreeTextDatatype':
    case 'org.openmrs.customdatatype.datatype.LongFreeTextDatatype':
    case 'org.openmrs.customdatatype.datatype.BooleanDatatype':
      return value;
    case 'org.openmrs.customdatatype.datatype.DateDatatype':
      return formatDate(new Date(value), {
        mode: 'wide',
      });
    default:
      return value;
  }
};

const VisitAttributeTags: React.FC<VisitAttributeTagsProps> = ({ patientUuid }) => {
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const { visitAttributeTypes } = useConfig<ChartConfig>();
  const visibleVisitAttributeTypes = new Set(
    (visitAttributeTypes ?? [])
      .filter(({ displayInThePatientBanner }) => displayInThePatientBanner)
      .map(({ uuid }) => uuid),
  );

  if (currentVisit?.voided || !Array.isArray(currentVisit?.attributes)) {
    return null;
  }

  return (
    <>
      {currentVisit.attributes
        .filter((attribute) => visibleVisitAttributeTypes.has(attribute?.attributeType?.uuid))
        .map((attribute) => {
          const value = getAttributeValue(attribute?.attributeType, attribute?.value);

          return value !== null && value !== undefined && value !== '' ? (
            <Tag key={attribute?.uuid ?? attribute?.attributeType?.uuid} type="gray">
              {String(value)}
            </Tag>
          ) : null;
        })}
    </>
  );
};

export default VisitAttributeTags;
