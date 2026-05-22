import { Button } from '@carbon/react';
import { navigate, showModal, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { processCommunityReferral } from './referrals.resource';
import type { ReferralReasons } from './types';

type ReferralActionsProps = {
  referralData: ReferralReasons;
  status: string;
};

const ReferralActions: React.FC<ReferralActionsProps> = ({ referralData, status }) => {
  const { t } = useTranslation();

  const handleProcessReferral = useCallback(() => {
    processCommunityReferral(referralData.messageId)
      .then((res) => {
        showSnackbar({
          title: t('processReferral', 'Process referral'),
          subtitle: t('processReferralSuccess', 'Patient registered successfully'),
          kind: 'success',
          timeoutInMs: 3500,
          isLowContrast: true,
        });
        navigate({
          to: `${globalThis.getOpenmrsSpaBase()}patient/${res.data?.uuid}/chart/Patient Summary`,
        });
      })
      .catch((error) => {
        showSnackbar({
          title: t('processReferral', 'Process referral'),
          subtitle: error?.message ?? t('processReferralError', 'Process referral error'),
          kind: 'error',
          timeoutInMs: 3500,
          isLowContrast: true,
        });
      });
  }, [referralData.messageId, t]);

  const handleViewReasons = useCallback(() => {
    const dispose = showModal('referral-reasons-dialog', {
      closeModal: () => dispose(),
      handleProcessReferral,
      referralReasons: referralData,
      status,
    });
  }, [handleProcessReferral, referralData, status]);

  return (
    <div className="referrals-action-set">
      <Button kind="ghost" size="sm" onClick={handleViewReasons}>
        {t('viewReasons', 'View reasons')}
      </Button>
      {status === 'completed' ? null : (
        <Button kind="primary" size="sm" onClick={handleProcessReferral}>
          {t('serveClient', 'Serve client')}
        </Button>
      )}
    </div>
  );
};

export default ReferralActions;
