import React from 'react';
import { useTranslation } from 'react-i18next';

import BiometricsBase from './biometrics-base.component';

interface BiometricsProps {
  patientUuid: string;
  basePath: string;
  patient?: fhir.Patient;
}

const BiometricsOverview: React.FC<BiometricsProps> = ({ patientUuid, basePath: _basePath, patient }) => {
  const { t } = useTranslation();
  const pageSize = 5;
  const pageUrl = `${globalThis.spaBase}/patient/${patientUuid}/chart/vitals-and-biometrics`;
  const urlLabel = t('seeAll', 'See all');

  return (
    <BiometricsBase
      patientUuid={patientUuid}
      pageSize={pageSize}
      urlLabel={urlLabel}
      pageUrl={pageUrl}
      patient={patient}
    />
  );
};

export default BiometricsOverview;
