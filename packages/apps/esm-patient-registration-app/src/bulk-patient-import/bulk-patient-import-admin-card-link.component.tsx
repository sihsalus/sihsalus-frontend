import { ClickableTile, Layer } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName, patientImport } from '../constants';

const BulkPatientImportAdminCardLink: React.FC = () => {
  const { t } = useTranslation(moduleName);

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
