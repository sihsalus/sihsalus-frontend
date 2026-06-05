import React, { useCallback } from 'react';
import styles from './billing-checkin-form.scss';
import VisitAttributesForm from './visit-attributes/visit-attributes-form.component';

type BillingCheckInFormProps = {
  patientUuid: string;
  setExtraVisitInfo: (state) => void;
};

const BillingCheckInForm: React.FC<BillingCheckInFormProps> = ({ setExtraVisitInfo }) => {
  const handleAttributesChange = useCallback(
    (attributes) => {
      setExtraVisitInfo({
        attributes,
      });
    },
    [setExtraVisitInfo],
  );

  return (
    <section className={styles.sectionContainer}>
      <VisitAttributesForm setAttributes={handleAttributesChange} />
    </section>
  );
};

export default React.memo(BillingCheckInForm);
