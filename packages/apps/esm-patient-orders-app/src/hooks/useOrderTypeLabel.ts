import { useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';

export function useOrderTypeLabel() {
  const { orderTypes } = useConfig<ConfigObject>();
  const { t } = useTranslation();

  return useCallback(
    (orderTypeUuid: string, fallbackLabel = '') => {
      const label = orderTypes?.find((orderType) => orderType.orderTypeUuid === orderTypeUuid)?.label;
      return label ? t(label, { defaultValue: label }) : fallbackLabel;
    },
    [orderTypes, t],
  );
}
