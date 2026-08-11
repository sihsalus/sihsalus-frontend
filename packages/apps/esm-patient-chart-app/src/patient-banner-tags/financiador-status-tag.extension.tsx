import { Tag } from '@carbon/react';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

const FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID = '3a988e33-a6c0-4b76-b924-01abb998944b';
const ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID = '5e13e902-2030-4f65-b9d5-9a4810c9a603';

type CarbonTagType = 'green' | 'red' | 'gray';

interface FinanciadorStatusTagProps {
  patientUuid: string;
}

function getAttributeDisplay(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    const coded = value as { display?: string; name?: string | { display?: string } };
    if (typeof coded.display === 'string') {
      return coded.display;
    }
    if (typeof coded.name === 'string') {
      return coded.name;
    }
    if (typeof coded.name === 'object' && typeof coded.name?.display === 'string') {
      return coded.name.display;
    }
  }
  return null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

export function getAccreditationTagType(statusDisplay: string | null): CarbonTagType {
  const normalized = statusDisplay ? normalize(statusDisplay) : '';
  if (normalized.includes('no vigente')) {
    return 'red';
  }
  if (normalized.includes('vigente')) {
    return 'green';
  }
  // Pendiente, No consultada, or a missing status: the coverage is not validated.
  return 'gray';
}

/**
 * One banner tag for the whole coverage fact: the financer as the label and the
 * SIS accreditation as the color (green current, red not current, gray not yet
 * validated). Replaces the three separate gray tags the generic visit-attribute
 * renderer produced; the insurance number stays available in "Show more".
 */
const FinanciadorStatusTag: React.FC<FinanciadorStatusTagProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  if (currentVisit?.voided || !Array.isArray(currentVisit?.attributes)) {
    return null;
  }

  const findAttribute = (attributeTypeUuid: string) =>
    currentVisit.attributes.find((attribute) => attribute?.attributeType?.uuid === attributeTypeUuid);

  const financiadorDisplay = getAttributeDisplay(findAttribute(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)?.value);
  if (!financiadorDisplay) {
    return null;
  }

  const statusDisplay = getAttributeDisplay(findAttribute(ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)?.value);
  const tagType = getAccreditationTagType(statusDisplay);
  const statusLabel = statusDisplay ?? t('accreditationNotValidated', 'Acreditación no validada');

  return (
    <Tag type={tagType} title={`${financiadorDisplay} — ${statusLabel}`}>
      {financiadorDisplay}
    </Tag>
  );
};

export default FinanciadorStatusTag;
