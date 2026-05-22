import {
  Button,
  ModalBody,
  ModalFooter,
  ModalHeader,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ReferralReasons } from './types';

type ReferralReasonsModalProps = {
  closeModal: () => void;
  handleProcessReferral: () => void;
  referralReasons: ReferralReasons;
  status: string;
};

const ReferralReasonsModal: React.FC<ReferralReasonsModalProps> = ({
  closeModal,
  handleProcessReferral,
  referralReasons,
  status,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('referralReasons', 'Referral reasons')} />
      <ModalBody>
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            <StructuredListRow>
              <StructuredListCell>{t('department', 'Department')}</StructuredListCell>
              <StructuredListCell>{referralReasons.category || t('notRecorded', 'Not recorded')}</StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell>{t('reasonCode', 'Reason code')}</StructuredListCell>
              <StructuredListCell>{referralReasons.reasonCode || t('notRecorded', 'Not recorded')}</StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell>{t('clinicalNotes', 'Clinical notes')}</StructuredListCell>
              <StructuredListCell>
                {referralReasons.clinicalNote || t('notRecorded', 'Not recorded')}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('close', 'Close')}
        </Button>
        {status === 'completed' ? null : (
          <Button onClick={handleProcessReferral}>{t('serveClient', 'Serve client')}</Button>
        )}
      </ModalFooter>
    </>
  );
};

export default ReferralReasonsModal;
