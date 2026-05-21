import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';

import {
  PROCESSING_REPORT_STATUSES,
  RAN_REPORT_STATUSES,
  SCHEDULED_REPORT_STATUSES,
} from '../report-statuses-constants';
import { cancelReportRequest } from '../reports.resource';

interface CancelReportModalProps {
  closeModal: () => void;
  reportRequestUuid: string;
  modalType: ModalType;
}

type ModalType = 'delete' | 'cancel' | 'schedule';

const CancelReportModal: React.FC<CancelReportModalProps> = ({ closeModal, reportRequestUuid, modalType }) => {
  const { t } = useTranslation();
  const [isCanceling, setIsCanceling] = useState(false);

  const getModalTitleByType = useCallback(
    (modalType: ModalType) => {
      if (modalType === 'delete') {
        return t('deleteReport', 'Delete report');
      } else if (modalType === 'cancel') {
        return t('cancelReport', 'Cancel report');
      } else if (modalType === 'schedule') {
        return t('scheduleReport', 'Schedule report');
      }
    },
    [t],
  );

  const getModalBodyByType = useCallback(
    (modalType: ModalType) => {
      if (modalType === 'delete') {
        return t('deleteReportModalText', 'Are you sure you want to delete this report?');
      } else if (modalType === 'cancel') {
        return t('cancelReportModalText', 'Are you sure you want to cancel this report?');
      } else if (modalType === 'schedule') {
        return t('deleteReportScheduleModalText', 'Are you sure you want to delete this schedule?');
      }
    },
    [t],
  );

  const getSuccessToastMessageByType = useCallback(
    (modalType: ModalType) => {
      if (modalType === 'delete') {
        return t('reportDeletedSuccessfully', 'Report deleted successfully');
      } else if (modalType === 'cancel') {
        return t('reportCancelledSuccessfully', 'Report cancelled successfully');
      } else if (modalType === 'schedule') {
        return t('reportScheduleDeletedSuccessfully', 'Report schedule deleted successfully');
      }
    },
    [t],
  );

  const getFailedToastMessageByType = useCallback(
    (modalType: ModalType) => {
      if (modalType === 'delete') {
        return t('reportDeletingErrorMsg', 'Error during report deleting');
      } else if (modalType === 'cancel') {
        return t('reportCancelingErrorMsg', 'Error during report canceling');
      } else if (modalType === 'schedule') {
        return t('reportScheduleDeletingErrorMsg', 'Error during report schedule deleting');
      }
    },
    [t],
  );

  const getLoadingMessageByType = useCallback(
    (modalType: ModalType) => {
      if (modalType === 'delete' || modalType === 'schedule') {
        return t('deleting', 'Deleting');
      } else if (modalType === 'cancel') {
        return t('cancelling', 'Cancelling');
      }
    },
    [t],
  );

  async function handleCancel() {
    try {
      setIsCanceling(true);
      await cancelReportRequest(reportRequestUuid);
      callMutates(modalType);
      closeModal();
      showSnackbar({
        kind: 'success',
        title: getModalTitleByType(modalType),
        subtitle: getSuccessToastMessageByType(modalType),
      });
    } catch {
      showSnackbar({
        kind: 'error',
        title: getModalTitleByType(modalType),
        subtitle: getFailedToastMessageByType(modalType),
      });
    } finally {
      setIsCanceling(false);
    }
  }

  const callMutates = (modalType: ModalType) => {
    const baseUrl = '/ws/rest/v1/reportingrest/reportRequest?status=';
    if (modalType === 'delete') {
      mutate(baseUrl + RAN_REPORT_STATUSES.join(','));
    } else if (modalType === 'cancel') {
      mutate(baseUrl + RAN_REPORT_STATUSES.join(','));
      mutate(baseUrl + PROCESSING_REPORT_STATUSES.join(','));
    } else if (modalType === 'schedule') {
      mutate(baseUrl + SCHEDULED_REPORT_STATUSES.join(',') + '&sortBy=name');
    }
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={getModalTitleByType(modalType)} />
      <ModalBody>
        <p>{getModalBodyByType(modalType)}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('no', 'No')}
        </Button>
        <Button kind="danger" onClick={handleCancel} disabled={isCanceling}>
          {isCanceling ? (
            <InlineLoading description={getLoadingMessageByType(modalType) + '...'} />
          ) : (
            <span>{t('yes', 'Yes')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default CancelReportModal;
