import { ClickableTile, Layer } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useConfig, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { isCanonicalUtcInstant, type RegistrationConfig } from '../config-schema';
import { moduleName, patientImport } from '../constants';

const BulkPatientImportAdminCardLink: React.FC = () => {
  const { t } = useTranslation(moduleName);
  const { bulkPatientImport } = useConfig<RegistrationConfig>();
  const session = useSession();

  if (
    !bulkPatientImport.enabled ||
    !isCanonicalUtcInstant(bulkPatientImport.approvalExpiresAt) ||
    Date.parse(bulkPatientImport.approvalExpiresAt) <= Date.now() ||
    bulkPatientImport.approvedOrigin !== globalThis.location.origin ||
    bulkPatientImport.approvedUserUuid !== session?.user?.uuid ||
    bulkPatientImport.approvedLocationUuid !== session?.sessionLocation?.uuid
  ) {
    return null;
  }

  return (
    <Layer>
      <ClickableTile href={`${globalThis.spaBase}/${patientImport}`}>
        <div>
          <div className="heading">{t('bulkPatientImportAdminCardTitle', 'Import patients')}</div>
          <div className="content">
            {t('bulkPatientImportAdminCardDescription', 'Validate an Excel template and create patients')}
          </div>
        </div>
        <div className="iconWrapper">
          <ArrowRight size={16} />
        </div>
      </ClickableTile>
    </Layer>
  );
};

export default BulkPatientImportAdminCardLink;
