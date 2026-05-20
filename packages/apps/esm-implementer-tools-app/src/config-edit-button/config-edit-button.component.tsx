import React from 'react';
import { useTranslation } from 'react-i18next';

import { implementerToolsStore } from '../store';

interface ConfigEditButtonProps {
  configPath: string[];
}

export default function ConfigEditButton({ configPath }: ConfigEditButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => {
        implementerToolsStore.setState({ configPathBeingEdited: configPath });
      }}
    >
      {t('edit', 'Edit')}
    </button>
  );
}
