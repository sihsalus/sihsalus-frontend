import { Tag } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import React from 'react';

import { type ChartConfig } from '../config-schema';

interface VisitAttributeTagsProps {
  patientUuid: string;
}

interface VisitAttributeTypeLike {
  datatypeClassname?: string;
}

function getDisplayValue(value: unknown, depth = 0): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value) || depth >= 2) {
    return null;
  }

  const resource = value as Record<string, unknown>;
  for (const key of ['display', 'name', 'value']) {
    const displayValue = getDisplayValue(resource[key], depth + 1);
    if (displayValue !== null && displayValue !== '') {
      return displayValue;
    }
  }

  return null;
}

function getAttributeValue(attributeType: VisitAttributeTypeLike | null | undefined, value: unknown): string | null {
  const displayValue = getDisplayValue(value);
  if (!displayValue) {
    return null;
  }

  if (attributeType?.datatypeClassname === 'org.openmrs.customdatatype.datatype.DateDatatype') {
    const date = new Date(displayValue);
    return Number.isNaN(date.getTime()) ? null : formatDate(date, { mode: 'wide' });
  }

  return displayValue;
}

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
              {value}
            </Tag>
          ) : null;
        })}
    </>
  );
};

export default VisitAttributeTags;
