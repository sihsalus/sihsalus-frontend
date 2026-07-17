import { StructuredListSkeleton } from '@carbon/react';
import { type PatientProgram } from '@openmrs/esm-patient-common-lib';
import React from 'react';

import { useRecommendedVisitTypes } from '../hooks/useRecommendedVisitTypes';

import BaseVisitType from './base-visit-type.component';

interface RecommendedVisitTypeProp {
  allowedVisitTypeUuids?: Set<string>;
  patientUuid: string;
  patientProgramEnrollment: PatientProgram;
  locationUuid: string;
}

const RecommendedVisitType: React.FC<RecommendedVisitTypeProp> = ({
  allowedVisitTypeUuids,
  patientUuid,
  patientProgramEnrollment,
  locationUuid,
}) => {
  const { recommendedVisitTypes, isLoading } = useRecommendedVisitTypes(
    patientUuid,
    patientProgramEnrollment?.uuid,
    patientProgramEnrollment?.program?.uuid,
    locationUuid,
  );
  const availableRecommendedVisitTypes = allowedVisitTypeUuids
    ? recommendedVisitTypes.filter((visitType) => allowedVisitTypeUuids.has(visitType.uuid))
    : recommendedVisitTypes;

  return (
    <div style={{ marginTop: '0.625rem' }}>
      {isLoading ? <StructuredListSkeleton /> : <BaseVisitType visitTypes={availableRecommendedVisitTypes} />}
    </div>
  );
};

export const MemoizedRecommendedVisitType = React.memo(RecommendedVisitType);
