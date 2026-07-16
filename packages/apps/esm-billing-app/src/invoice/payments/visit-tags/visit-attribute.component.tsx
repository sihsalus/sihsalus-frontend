import { Tag } from '@carbon/react';
import React from 'react';
import { usePatientPaymentInfo } from '../../../billing.resource';

type VisitAttributeTagsProps = { patientUuid: string };

function getVisitAttributeDisplayValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object' && 'display' in value && typeof value.display === 'string') {
    return value.display;
  }

  return null;
}

const VisitAttributeTags: React.FC<VisitAttributeTagsProps> = ({ patientUuid }) => {
  const patientBillingInfo = usePatientPaymentInfo(patientUuid);
  return (
    <div>
      {patientBillingInfo?.map((tag) => {
        const displayValue = getVisitAttributeDisplayValue(tag.value);

        return (
          <React.Fragment key={tag.name}>
            <Tag type="gray">{tag.name}</Tag>
            {displayValue !== null && <Tag type="cool-gray">{displayValue}</Tag>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default VisitAttributeTags;
