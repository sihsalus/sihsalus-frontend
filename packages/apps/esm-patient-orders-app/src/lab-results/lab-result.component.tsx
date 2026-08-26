import { InlineLoading, InlineNotification, Tile } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import TestOrder from '../components/test-order.component';

import styles from './lab-result.scss';
import { useCompletedLabResults, useOrderConceptByUuid } from './lab-results.resource';

type LabResultsProps = {
  order: Order;
};
const LabResults: React.FC<LabResultsProps> = ({ order }) => {
  const { t } = useTranslation();
  const { isLoading: isLoadingConcepts, error: conceptError } = useOrderConceptByUuid(order.concept.uuid);
  const { isLoading, error } = useCompletedLabResults(order);

  if (isLoading || isLoadingConcepts)
    return (
      <InlineLoading
        status="active"
        iconDescription="Loading"
        description={t('loadinglabresults', 'Loading lab results') + '...'}
      />
    );

  if (error || conceptError)
    return (
      <InlineNotification
        kind="error"
        title={t('labResultError', 'Error loading lab results')}
        subtitle={getUserFacingErrorMessage(
          error ?? conceptError,
          t('labResultErrorMessage', 'No se pudieron cargar los resultados de laboratorio. Intente nuevamente.'),
          { logContext: 'Load laboratory results' },
        )}
      />
    );

  return (
    <Tile className={styles.resultsCiontainer}>
      <OrderDetail order={order} />
    </Tile>
  );
};

export default LabResults;

const OrderDetail = ({ order }: { order: Order }) => {
  return <TestOrder testOrder={order} hideInstructions={true} hideSupplementalPdf={true} />;
};
