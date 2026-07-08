import { Button, Checkbox, Select, SelectItem, Tile } from '@carbon/react';
import {
  AddIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MaybeIcon,
  OpenmrsDatePicker,
  useConfig,
} from '@openmrs/esm-framework';
import { type OrderBasketItem, useOrderBasket, useOrderType } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import type { TestOrderBasketItem } from '../../types';
import { prepTestOrderPostData } from '../api';

import { LabOrderBasketItemTile } from './lab-order-basket-item-tile.component';
import styles from './lab-order-basket-panel.scss';

/**
 * Designs: https://app.zeplin.io/project/60d59321e8100b0324762e05/screen/648c44d9d4052c613e7f23da
 */
interface LabOrderBasketPanelExtensionProps {
  launchAddLabOrder?: (orderTypeUuid: string, order?: OrderBasketItem) => void;
}

export default function LabOrderBasketPanelExtension({ launchAddLabOrder }: LabOrderBasketPanelExtensionProps) {
  const { orders, additionalTestOrderTypes } = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const allOrderTypes: ConfigObject['additionalTestOrderTypes'] = [
    {
      label: t('labOrders', 'Lab orders'),
      orderTypeUuid: orders.labOrderTypeUuid,
      orderableConceptSets: orders.labOrderableConcepts,
      icon: 'omrs-icon-lab-order',
    },
    ...additionalTestOrderTypes,
  ];

  return (
    <>
      {allOrderTypes.map((orderTypeConfig) => (
        <LabOrderBasketPanel
          key={orderTypeConfig.orderTypeUuid}
          {...orderTypeConfig}
          launchAddLabOrder={launchAddLabOrder}
        />
      ))}
    </>
  );
}

type OrderTypeConfig = ConfigObject['additionalTestOrderTypes'][0];

interface LabOrderBasketPanelProps extends OrderTypeConfig {
  launchAddLabOrder?: (orderTypeUuid: string, order?: OrderBasketItem) => void;
}

const priorityOrder: Record<string, number> = {
  'e724bdb6-2c75-4b6f-a00c-d43f2c372974': 1, // Emergencia
  'b96959db-2106-4ce7-b39b-6fcb2ca88cda': 2, // Urgente
  '427a595a-a5ee-4ba7-bcb7-2503248efb31': 3, // Urgencia menor
  'bf3a08c6-cbe6-4f00-8e06-5f5437790b85': 4, // Rutina
  '65cf194e-05a7-4832-ba6d-9b7c9940a7c2': 5, // Programado
};
const priorityStorageKey = 'sihsalus-lab-order-basket-priority';

function LabOrderBasketPanel({ orderTypeUuid, label, icon, launchAddLabOrder }: LabOrderBasketPanelProps) {
  const { t } = useTranslation();
  const { orderType, isLoadingOrderType } = useOrderType(orderTypeUuid);
  const config = useConfig<ConfigObject>();
  const { orders: orderConfig, priorityConfigs } = config;

  const sortedPriorityConfigs = useMemo(() => {
    if (!priorityConfigs) return [];
    return [...priorityConfigs].sort((a, b) => {
      const orderA = priorityOrder[a.conceptUuid] ?? 99;
      const orderB = priorityOrder[b.conceptUuid] ?? 99;
      return orderA - orderB;
    });
  }, [priorityConfigs]);
  const prepareTestOrderPostData = useCallback(
    (order: TestOrderBasketItem, patientUuid: string, encounterUuid: string | null) =>
      prepTestOrderPostData(order, patientUuid, encounterUuid, orderConfig.careSettingUuid),
    [orderConfig.careSettingUuid],
  );

  const { orders, setOrders } = useOrderBasket<TestOrderBasketItem>(orderTypeUuid, prepareTestOrderPostData);
  const [isExpanded, setIsExpanded] = useState(orders.length > 0);

  const HOSPITALIZED_TEXT = 'paciente hospitalizado';
  const REGIONAL_TEXT = 'solo para ser enviado a hospital regional';

  // Inicializar checkboxes basándose en los items que ya están en la canasta
  const [isHospitalized, setIsHospitalized] = useState(() => {
    return orders.some((order) => (order.instructions || '').toLowerCase().includes(HOSPITALIZED_TEXT));
  });

  const [isRegional, setIsRegional] = useState(() => {
    return orders.some((order) => (order.instructions || '').toLowerCase().includes(REGIONAL_TEXT));
  });

  const handleHospitalizedChange = (checked: boolean) => {
    setIsHospitalized(checked);
    if (checked) {
      setIsRegional(false);
      // Restablecer todas las órdenes para que tengan ÚNICAMENTE el texto "paciente hospitalizado"
      const newOrders = orders.map((order) => {
        return { ...order, instructions: HOSPITALIZED_TEXT };
      });
      setOrders(newOrders);
    } else {
      // Remover únicamente HOSPITALIZED_TEXT de todas las órdenes
      const newOrders = orders.map((order) => {
        const nextInstructions = (order.instructions || '')
          .split('\n')
          .filter((line) => line.trim().toLowerCase() !== HOSPITALIZED_TEXT)
          .join('\n');
        return { ...order, instructions: nextInstructions };
      });
      setOrders(newOrders);
    }
  };

  const handleRegionalChange = (checked: boolean) => {
    setIsRegional(checked);
    if (checked) {
      setIsHospitalized(false);
      // Restablecer todas las órdenes para que tengan ÚNICAMENTE el texto "solo para ser enviado a hospital regional"
      const newOrders = orders.map((order) => {
        return { ...order, instructions: REGIONAL_TEXT };
      });
      setOrders(newOrders);
    } else {
      // Remover únicamente REGIONAL_TEXT de todas las órdenes
      const newOrders = orders.map((order) => {
        const nextInstructions = (order.instructions || '')
          .split('\n')
          .filter((line) => line.trim().toLowerCase() !== REGIONAL_TEXT)
          .join('\n');
        return { ...order, instructions: nextInstructions };
      });
      setOrders(newOrders);
    }
  };

  const prevOrdersRef = useRef<Array<any>>(orders);

  // Sincronizar el texto de las instrucciones de las órdenes en la canasta
  useEffect(() => {
    const prevOrders = prevOrdersRef.current;
    prevOrdersRef.current = orders;

    // Detectar si se ha agregado una nueva orden a la canasta
    const addedOrders = orders.filter(
      (order) => !prevOrders.some((prev) => prev.testType?.conceptUuid === order.testType?.conceptUuid),
    );

    if (addedOrders.length > 0) {
      let needsUpdate = false;
      const newOrders = orders.map((order) => {
        const isNew = addedOrders.some((added) => added.testType?.conceptUuid === order.testType?.conceptUuid);
        if (isNew) {
          let nextInstructions = order.instructions || '';
          if (isHospitalized && !nextInstructions.toLowerCase().includes(HOSPITALIZED_TEXT)) {
            nextInstructions = nextInstructions ? `${nextInstructions}\n${HOSPITALIZED_TEXT}` : HOSPITALIZED_TEXT;
            needsUpdate = true;
          }
          if (isRegional && !nextInstructions.toLowerCase().includes(REGIONAL_TEXT)) {
            nextInstructions = nextInstructions ? `${nextInstructions}\n${REGIONAL_TEXT}` : REGIONAL_TEXT;
            needsUpdate = true;
          }
          return {
            ...order,
            instructions: nextInstructions,
          };
        }
        return order;
      });

      if (needsUpdate) {
        setOrders(newOrders);
      }
    }
  }, [orders, isHospitalized, isRegional, setOrders]);

  const [selectedPriorityUuid, setSelectedPriorityUuid] = useState<string>(() => {
    const savedPriorityUuid = localStorage.getItem(priorityStorageKey);
    return (
      sortedPriorityConfigs.find((priority) => priority.conceptUuid === savedPriorityUuid)?.conceptUuid ??
      sortedPriorityConfigs[0]?.conceptUuid ??
      ''
    );
  });

  const [bulkScheduledDate, setBulkScheduledDate] = useState<Date | null>(null);

  const selectedPriority = priorityConfigs?.find((p) => p.conceptUuid === selectedPriorityUuid);
  const requiresScheduledDate = selectedPriority?.requiresScheduledDate ?? false;

  const handlePriorityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriorityUuid = event.target.value;
    setSelectedPriorityUuid(newPriorityUuid);
    localStorage.setItem(priorityStorageKey, newPriorityUuid);

    const priority = priorityConfigs?.find((p) => p.conceptUuid === newPriorityUuid);
    const newUrgencyCode = priority?.urgency ?? 'STAT';
    const needsDate = priority?.requiresScheduledDate ?? false;

    if (!needsDate) {
      setBulkScheduledDate(null);
    }

    const updatedOrders = orders.map((order) => {
      const finalDate = needsDate ? bulkScheduledDate : null;
      return {
        ...order,
        urgency: newPriorityUuid,
        urgencyCode: newUrgencyCode,
        scheduledDate: finalDate,
        isOrderIncomplete: needsDate ? !finalDate : false,
      };
    });
    setOrders(updatedOrders);
  };

  const handleBulkDateChange = (date: Date) => {
    setBulkScheduledDate(date);

    const updatedOrders = orders.map((order) => {
      return {
        ...order,
        scheduledDate: date,
        isOrderIncomplete: false,
      };
    });
    setOrders(updatedOrders);
  };

  useEffect(() => {
    if (!sortedPriorityConfigs.length) {
      return;
    }

    const selectedPriorityIsValid = sortedPriorityConfigs.some(
      (priority) => priority.conceptUuid === selectedPriorityUuid,
    );
    if (!selectedPriorityIsValid) {
      const fallbackPriorityUuid = sortedPriorityConfigs[0].conceptUuid;
      setSelectedPriorityUuid(fallbackPriorityUuid);
      localStorage.setItem(priorityStorageKey, fallbackPriorityUuid);
      return;
    }

    const hasEmptyUrgency = orders.some((order) => !order.urgency);
    if (hasEmptyUrgency) {
      const selectedPriority = priorityConfigs?.find((p) => p.conceptUuid === selectedPriorityUuid);
      const newUrgencyCode = selectedPriority?.urgency ?? 'STAT';
      const needsDate = selectedPriority?.requiresScheduledDate ?? false;

      const updatedOrders = orders.map((order) => {
        if (!order.urgency) {
          const finalDate = needsDate ? bulkScheduledDate : null;
          return {
            ...order,
            urgency: selectedPriorityUuid,
            urgencyCode: newUrgencyCode,
            scheduledDate: finalDate,
            isOrderIncomplete: needsDate ? !finalDate : false,
          };
        }
        return order;
      });
      setOrders(updatedOrders);
    }
  }, [orders, selectedPriorityUuid, priorityConfigs, setOrders, bulkScheduledDate, sortedPriorityConfigs]);

  const {
    incompleteOrderBasketItems,
    newOrderBasketItems,
    renewedOrderBasketItems,
    revisedOrderBasketItems,
    discontinuedOrderBasketItems,
  } = useMemo(() => {
    const incompleteOrderBasketItems: Array<TestOrderBasketItem> = [];
    const newOrderBasketItems: Array<TestOrderBasketItem> = [];
    const renewedOrderBasketItems: Array<TestOrderBasketItem> = [];
    const revisedOrderBasketItems: Array<TestOrderBasketItem> = [];
    const discontinuedOrderBasketItems: Array<TestOrderBasketItem> = [];

    orders.forEach((order) => {
      if (order?.isOrderIncomplete) {
        incompleteOrderBasketItems.push(order);
      } else if (order.action === 'NEW') {
        newOrderBasketItems.push(order);
      } else if (order.action === 'RENEW') {
        renewedOrderBasketItems.push(order);
      } else if (order.action === 'REVISE') {
        revisedOrderBasketItems.push(order);
      } else if (order.action === 'DISCONTINUE') {
        discontinuedOrderBasketItems.push(order);
      }
    });

    return {
      incompleteOrderBasketItems,
      newOrderBasketItems,
      renewedOrderBasketItems,
      revisedOrderBasketItems,
      discontinuedOrderBasketItems,
    };
  }, [orders]);

  const openNewLabForm = useCallback(() => {
    launchAddLabOrder?.(orderTypeUuid);
  }, [launchAddLabOrder, orderTypeUuid]);

  const openEditLabForm = useCallback(
    (order: OrderBasketItem) => {
      launchAddLabOrder?.(orderTypeUuid, order);
    },
    [launchAddLabOrder, orderTypeUuid],
  );

  const removeLabOrder = useCallback(
    (order: TestOrderBasketItem) => {
      const newOrders = [...orders];
      newOrders.splice(orders.indexOf(order), 1);
      setOrders(newOrders);
    },
    [orders, setOrders],
  );

  useEffect(() => {
    setIsExpanded(orders.length > 0);
  }, [orders]);

  if (isLoadingOrderType || orderType?.javaClassName !== 'org.openmrs.TestOrder') {
    return null;
  }

  return (
    <Tile
      className={classNames(styles.tile, styles.desktopTile, {
        [styles.collapsedTile]: !isExpanded,
      })}
    >
      <div className={styles.container}>
        <div className={styles.iconAndLabel}>
          <MaybeIcon icon={icon ? icon : 'omrs-icon-generic-order-type'} size={24} />
          <h4 className={styles.heading}>{`${label ? t(label) : orderType?.display} (${orders.length})`}</h4>
        </div>
        <div className={styles.buttonContainer}>
          <Button
            className={styles.addButton}
            iconDescription="Add lab order"
            kind="ghost"
            onClick={openNewLabForm}
            renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
            size="sm"
          >
            {t('add', 'Add')}
          </Button>
          <Button
            className={styles.chevron}
            disabled={orders.length === 0}
            hasIconOnly
            iconDescription="View"
            kind="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            renderIcon={(props: ComponentProps<typeof ChevronUpIcon>) =>
              isExpanded ? <ChevronUpIcon size={16} {...props} /> : <ChevronDownIcon size={16} {...props} />
            }
          >
            {t('add', 'Add')}
          </Button>
        </div>
      </div>
      {isExpanded && orders.length > 0 && (
        <>
          <div className={styles.prioritySelectorContainer}>
            <Select
              id="bulk-priority-select"
              labelText={t('priority', 'Priority')}
              value={selectedPriorityUuid}
              onChange={handlePriorityChange}
              size="sm"
            >
              {sortedPriorityConfigs.map((option) => (
                <SelectItem key={option.conceptUuid} text={option.label} value={option.conceptUuid} />
              ))}
            </Select>
          </div>
          {requiresScheduledDate && (
            <div className={styles.bulkDatePickerWrapper}>
              <OpenmrsDatePicker
                id="bulk-scheduled-date"
                labelText={t('scheduledDate', 'Scheduled date')}
                value={bulkScheduledDate}
                onChange={handleBulkDateChange}
                minDate={new Date()}
              />
            </div>
          )}
          <div className={styles.checkboxesContainer}>
            <Checkbox
              id="hospitalized-patient-checkbox"
              labelText={t('hospitalizedPatient', 'Paciente hospitalizado')}
              checked={isHospitalized}
              onChange={(_, { checked }) => handleHospitalizedChange(checked)}
            />
            <Checkbox
              id="regional-hospital-checkbox"
              labelText={t('onlyRegionalHospital', 'Solo para ser enviado a hospital regional')}
              checked={isRegional}
              onChange={(_, { checked }) => handleRegionalChange(checked)}
            />
          </div>
          {incompleteOrderBasketItems.length > 0 &&
            incompleteOrderBasketItems.map((order) => (
              <LabOrderBasketItemTile
                key={order.uuid}
                onItemClick={() => openEditLabForm(order)}
                onRemoveClick={() => removeLabOrder(order)}
                orderBasketItem={order}
              />
            ))}
          {newOrderBasketItems.length > 0 &&
            newOrderBasketItems.map((order) => (
              <LabOrderBasketItemTile
                key={order.uuid}
                onItemClick={() => openEditLabForm(order)}
                onRemoveClick={() => removeLabOrder(order)}
                orderBasketItem={order}
              />
            ))}
          {renewedOrderBasketItems.length > 0 &&
            renewedOrderBasketItems.map((order) => (
              <LabOrderBasketItemTile
                key={order.uuid}
                onItemClick={() => openEditLabForm(order)}
                onRemoveClick={() => removeLabOrder(order)}
                orderBasketItem={order}
              />
            ))}
          {revisedOrderBasketItems.length > 0 &&
            revisedOrderBasketItems.map((order) => (
              <LabOrderBasketItemTile
                key={order.uuid}
                onItemClick={() => openEditLabForm(order)}
                onRemoveClick={() => removeLabOrder(order)}
                orderBasketItem={order}
              />
            ))}
          {discontinuedOrderBasketItems.length > 0 &&
            discontinuedOrderBasketItems.map((order) => (
              <LabOrderBasketItemTile
                key={order.uuid}
                onItemClick={() => openEditLabForm(order)}
                onRemoveClick={() => removeLabOrder(order)}
                orderBasketItem={order}
              />
            ))}
        </>
      )}
    </Tile>
  );
}
