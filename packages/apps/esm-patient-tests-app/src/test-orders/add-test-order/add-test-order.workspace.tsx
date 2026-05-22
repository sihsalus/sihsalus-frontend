import { Button } from '@carbon/react';
import {
  ArrowLeftIcon,
  age,
  formatDate,
  getPatientName,
  parseDate,
  useConfig,
  useLayoutType,
  usePatient,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  launchPatientWorkspace,
  type OrderBasketItem,
  type PatientWorkspace2DefinitionProps,
  useOrderType,
  usePatientChartStore,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { capitalize } from 'lodash-es';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import type { TestOrderBasketItem } from '../../types';

import styles from './add-test-order.scss';
import { LabOrderForm } from './test-order-form.component';
import { TestTypeSearch } from './test-type-search.component';

export interface AddLabOrderWorkspaceAdditionalProps {
  order?: OrderBasketItem;
  orderTypeUuid: string;
  orderBasketWorkspaceName?: string;
}

export interface AddLabOrderWorkspaceProps extends DefaultPatientWorkspaceProps, AddLabOrderWorkspaceAdditionalProps {}

type Workspace2AddLabOrderWorkspaceProps = PatientWorkspace2DefinitionProps<
  AddLabOrderWorkspaceAdditionalProps,
  object
>;
type AddLabOrderWorkspaceComponentProps = AddLabOrderWorkspaceProps | Workspace2AddLabOrderWorkspaceProps;

function isWorkspace2Props(props: AddLabOrderWorkspaceComponentProps): props is Workspace2AddLabOrderWorkspaceProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

// Design: https://app.zeplin.io/project/60d5947dd636aebbd63dce4c/screen/640b06c440ee3f7af8747620
export default function AddLabOrderWorkspace(props: AddLabOrderWorkspaceComponentProps) {
  const initialOrder = isWorkspace2Props(props) ? props.workspaceProps?.order : props.order;
  const orderTypeUuid = isWorkspace2Props(props) ? props.workspaceProps.orderTypeUuid : props.orderTypeUuid;
  const orderBasketWorkspaceName = isWorkspace2Props(props)
    ? (props.workspaceProps.orderBasketWorkspaceName ?? 'order-basket')
    : (props.orderBasketWorkspaceName ?? 'order-basket');
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { patientUuid } = usePatientChartStore(isWorkspace2Props(props) ? props.groupProps.patientUuid : undefined);
  const { patient, isLoading: isLoadingPatient } = usePatient(patientUuid);
  const [currentLabOrder, setCurrentLabOrder] = useState(initialOrder as TestOrderBasketItem);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [workspaceTitle, setWorkspaceTitle] = useState(t('addLabOrderWorkspaceTitle', 'Add lab order'));
  const { additionalTestOrderTypes, orders } = useConfig<ConfigObject>();
  const { orderType } = useOrderType(orderTypeUuid);

  const allOrderTypes = useMemo(
    () => [
      {
        label: t('labOrders', 'Lab orders'),
        orderTypeUuid: orders.labOrderTypeUuid,
        orderableConceptSets: orders.labOrderableConcepts,
      },
      ...additionalTestOrderTypes,
    ],
    [additionalTestOrderTypes, orders.labOrderTypeUuid, orders.labOrderableConcepts, t],
  );

  const configuredOrderType = useMemo(
    () => allOrderTypes.find((orderType) => orderType.orderTypeUuid === orderTypeUuid),
    [allOrderTypes, orderTypeUuid],
  );

  useEffect(() => {
    const orderTypeDisplay = configuredOrderType?.label ?? orderType?.display;

    if (orderTypeDisplay) {
      const title = t(`addOrderableForOrderType`, 'Add {{orderTypeDisplay}}', {
        orderTypeDisplay: orderTypeDisplay.toLocaleLowerCase(),
      });

      if (isWorkspace2Props(props)) {
        setWorkspaceTitle(title);
      } else {
        props.setTitle(title);
      }
    }
  }, [configuredOrderType?.label, orderType, props, t]);

  const orderableConceptSets = useMemo(() => {
    return configuredOrderType?.orderableConceptSets ?? [];
  }, [configuredOrderType?.orderableConceptSets]);

  const patientName = patient ? getPatientName(patient) : '';

  const cancelOrder = useCallback(() => {
    if (isWorkspace2Props(props)) {
      setHasUnsavedChanges(false);
      void props.closeWorkspace({ discardUnsavedChanges: true });
      return;
    }

    props.closeWorkspace({
      ignoreChanges: true,
      onWorkspaceClose: () => launchPatientWorkspace(orderBasketWorkspaceName),
      closeWorkspaceGroup: false,
    });
  }, [orderBasketWorkspaceName, props]);

  const content = (
    <div className={styles.container}>
      {isTablet && !isLoadingPatient && (
        <div className={styles.patientHeader}>
          <span className={styles.bodyShort02}>{patientName}</span>
          <span className={classNames(styles.text02, styles.bodyShort01)}>
            {capitalize(patient?.gender)} &middot; {age(patient?.birthDate)} &middot;{' '}
            <span>{formatDate(parseDate(patient?.birthDate), { mode: 'wide', time: false })}</span>
          </span>
        </div>
      )}
      {!isTablet && (
        <div className={styles.backButton}>
          <Button
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof ArrowLeftIcon>) => <ArrowLeftIcon size={24} {...props} />}
            iconDescription="Return to order basket"
            size="sm"
            onClick={cancelOrder}
          >
            <span>{t('backToOrderBasket', 'Back to order basket')}</span>
          </Button>
        </div>
      )}
      {currentLabOrder ? (
        <LabOrderForm
          initialOrder={currentLabOrder}
          patientUuid={patientUuid}
          closeWorkspace={
            isWorkspace2Props(props)
              ? (options) => {
                  void props.closeWorkspace({ discardUnsavedChanges: options?.ignoreChanges });
                  options?.onWorkspaceClose?.();
                }
              : props.closeWorkspace
          }
          closeWorkspaceWithSavedChanges={
            isWorkspace2Props(props)
              ? (options) => {
                  setHasUnsavedChanges(false);
                  void props.closeWorkspace({ discardUnsavedChanges: true });
                  options?.onWorkspaceClose?.();
                }
              : props.closeWorkspaceWithSavedChanges
          }
          promptBeforeClosing={
            isWorkspace2Props(props) ? (testFcn) => setHasUnsavedChanges(testFcn()) : props.promptBeforeClosing
          }
          setTitle={() => {}}
          orderTypeUuid={orderTypeUuid}
          orderableConceptSets={orderableConceptSets}
          orderBasketWorkspaceName={orderBasketWorkspaceName}
          returnToOrderBasketOnClose={!isWorkspace2Props(props)}
        />
      ) : (
        <TestTypeSearch
          orderTypeUuid={orderTypeUuid}
          orderableConceptSets={orderableConceptSets}
          openLabForm={setCurrentLabOrder}
          returnToOrderBasket={cancelOrder}
        />
      )}
    </div>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={workspaceTitle} hasUnsavedChanges={hasUnsavedChanges}>
        {content}
      </Workspace2>
    );
  }

  return content;
}
