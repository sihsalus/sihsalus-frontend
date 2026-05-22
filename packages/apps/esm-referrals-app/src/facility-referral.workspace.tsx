import { Button, ButtonSet, Form, InlineNotification, Search, Stack, TextArea } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './referrals.scss';

type FacilityReferralWorkspaceProps = {
  closeWorkspace: () => void;
};

const FacilityReferralWorkspace: React.FC<FacilityReferralWorkspaceProps> = ({ closeWorkspace }) => {
  const { t } = useTranslation();
  const [patientUuid, setPatientUuid] = useState('');

  return (
    <Form className={styles.workspaceForm}>
      <Stack gap={5}>
        <InlineNotification
          kind="info"
          lowContrast
          title={t('backendPending', 'Backend pending')}
          subtitle={t(
            'referralBackendPending',
            'This workspace brings the KenyaEMR referral frontend. Sending referrals requires the referral interoperability backend.',
          )}
        />
        <section>
          <h4>{t('patient', 'Patient')}</h4>
          {patientUuid ? (
            <p>{patientUuid}</p>
          ) : (
            <ExtensionSlot
              name="patient-search-bar-slot"
              state={{
                selectPatientAction: setPatientUuid,
                buttonProps: { kind: 'primary' },
              }}
            />
          )}
        </section>
        <Search
          id="destination-facility"
          labelText={t('searchFacility', 'Search for facility')}
          placeholder={t('searchFacility', 'Search for facility')}
        />
        <Search
          id="referral-reasons"
          labelText={t('searchReasons', 'Search for referral reasons')}
          placeholder={t('searchReasons', 'Search for referral reasons')}
        />
        <TextArea id="clinical-notes" labelText={t('clinicalNotes', 'Clinical notes')} rows={4} />
      </Stack>
      <ButtonSet className={styles.buttonSet}>
        <Button kind="secondary" onClick={closeWorkspace}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" disabled>
          {t('submitReferral', 'Submit referral')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default FacilityReferralWorkspace;
