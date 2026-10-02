import { Button } from '@carbon/react';
import {
  AddIcon,
  launchWorkspace2,
  type Order,
  restBaseUrl,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { type Config } from '../../config-schema';
import { laboratoryEditPrivilege, labResultsWorkspaceName, labResultsAddOrderWorkspaceName } from '../../constants';
import styles from './actions.scss';

interface AddLabRequestResultsActionProps {
  order: Order;
}

const AddLabRequestResultsAction: React.FC<AddLabRequestResultsActionProps> = ({ order }) => {
  const { t } = useTranslation();
  const { laboratoryOrderTypeUuid } = useConfig<Config>();
  const session = useSession();
  const canEdit = userHasAccess(laboratoryEditPrivilege, session?.user);

  const invalidateLabOrders = () => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}`),
    );
  };

  const launchTestResultsWorkspace = () => {
    launchWorkspace2(
      labResultsWorkspaceName,
      {
        patient: order.patient,
        order,
        invalidateLabOrders,
        labOrderWorkspaceName: labResultsAddOrderWorkspaceName,
      },
      {
        patient: order.patient,
        patientUuid: order.patient.uuid,
        encounterUuid: order.encounter?.uuid ?? '',
        visitContext: order.encounter?.visit ?? null,
      },
    );
  };

  if (!canEdit) {
    return null;
  }

  return (
    <Button
      className={styles.actionButton}
      kind="primary"
      renderIcon={() => <AddIcon className={styles.actionButtonIcon} />}
      iconDescription={t('addLabResult', 'Add lab results')}
      onClick={launchTestResultsWorkspace}
      size="sm"
    >
      {t('addLabResult', 'Add lab results')}
    </Button>
  );
};

export default AddLabRequestResultsAction;
