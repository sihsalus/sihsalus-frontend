import { Button } from '@carbon/react';
import { launchWorkspace } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const AddStockSourceActionButton: React.FC = () => {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    launchWorkspace('stock-sources-form-workspace', {
      workspaceTitle: t('addNewStockSource', 'Add new source'),
    });
  }, [t]);

  return (
    <Button onClick={handleClick} size="md" kind="primary">
      {t('addNewStockSource', 'Add new source')}
    </Button>
  );
};

export default AddStockSourceActionButton;
