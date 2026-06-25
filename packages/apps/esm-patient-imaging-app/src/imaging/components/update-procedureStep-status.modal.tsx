import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProcedureStepStatus } from '../../api';

interface UpdateProcedureStepStatusProps {
  closeChangeStepStatusModel: () => void;
  stepId: number;
  status: string;
  mutateSteps: () => void;
}

const UpdateProcedureStepStatusModal: React.FC<UpdateProcedureStepStatusProps> = ({
  closeChangeStepStatusModel: closeChangeStepStatusModel,
  stepId,
  status,
  mutateSteps,
}) => {
  const { t } = useTranslation();
  const handleChangeStepStatus = useCallback(async () => {
    try {
      await updateProcedureStepStatus(status, stepId, new AbortController());
      mutateSteps();
      closeChangeStepStatusModel();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('changeStepStatus', 'The performed status of procedure step is changed'),
      });
    } catch (err: unknown) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorChangeStepStatus', 'An error occurred while changing the procedure step performed status'),
        subtitle: err instanceof Error ? err.message : undefined,
      });
    }
  }, [closeChangeStepStatusModel, stepId, status, t, mutateSteps]);

  return (
    <div>
      <ModalHeader closeModal={closeChangeStepStatusModel} title={t('rejectStep', 'Update procedure step')} />
      <ModalBody>
        <p>{t('changeProcedureStepMessage', 'Are you sure you want to change this procedure step?')}</p>
        <p style={{ color: 'red', marginTop: '10px' }}>
          {t('changeProcedureStepReject', 'You need to create a new procedure step to renew the rejected step!')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeChangeStepStatusModel}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleChangeStepStatus}>
          <span>{t('submit', 'submit')}</span>
        </Button>
      </ModalFooter>
    </div>
  );
};

export default UpdateProcedureStepStatusModal;
