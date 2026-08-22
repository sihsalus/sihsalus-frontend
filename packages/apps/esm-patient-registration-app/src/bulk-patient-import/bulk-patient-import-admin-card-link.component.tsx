import { ClickableTile, Layer } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useConfig, useSession } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isCanonicalUtcInstant, type RegistrationConfig } from '../config-schema';
import { moduleName, patientImport } from '../constants';

const BulkPatientImportAdminCardLink: React.FC = () => {
  const { t } = useTranslation(moduleName);
  const { bulkPatientImport } = useConfig<RegistrationConfig>();
  const session = useSession();
  const [approvalCheckTime, setApprovalCheckTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isCanonicalUtcInstant(bulkPatientImport.approvalExpiresAt)) {
      return;
    }

    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    const scheduleExpirationCheck = () => {
      const remainingMilliseconds = Date.parse(bulkPatientImport.approvalExpiresAt) - Date.now();
      if (remainingMilliseconds <= 0) {
        setApprovalCheckTime(Date.now());
        return;
      }
      timeout = globalThis.setTimeout(scheduleExpirationCheck, Math.min(remainingMilliseconds + 1, 2_147_483_647));
    };
    scheduleExpirationCheck();
    return () => {
      if (timeout !== undefined) {
        globalThis.clearTimeout(timeout);
      }
    };
  }, [bulkPatientImport.approvalExpiresAt]);

  if (
    !bulkPatientImport.enabled ||
    !isCanonicalUtcInstant(bulkPatientImport.approvalExpiresAt) ||
    Date.parse(bulkPatientImport.approvalExpiresAt) <= approvalCheckTime ||
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
