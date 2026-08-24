import { InlineNotification } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const FormLoadError = (): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <InlineNotification
      hideCloseButton
      kind="error"
      lowContrast
      role="alert"
      title={t('errorLoadingClinicalForm', 'The clinical form could not be loaded')}
      subtitle={t('errorLoadingClinicalFormDescription', 'This form cannot be opened or saved. Close it and try again.')}
    />
  );
};

export default FormLoadError;
