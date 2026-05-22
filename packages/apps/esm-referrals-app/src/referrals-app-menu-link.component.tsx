import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

const ReferralsAppMenuLink: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ConfigurableLink to={`${globalThis.getOpenmrsSpaBase()}referrals`}>{t('referrals', 'Referrals')}</ConfigurableLink>
  );
};

export default ReferralsAppMenuLink;
