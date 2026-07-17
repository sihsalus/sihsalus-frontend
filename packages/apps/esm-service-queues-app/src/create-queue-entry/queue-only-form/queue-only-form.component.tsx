import { Button, ButtonSet, Form } from '@carbon/react';
import { usePatient } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutateQueueEntries } from '../../hooks/useQueueEntries';
import styles from '../existing-visit-form/existing-visit-form.scss';
import QueueFields, { type QueueFieldsCallbacks } from '../queue-fields/queue-fields.component';

interface QueueOnlyFormProps {
  closeWorkspace: () => void;
  currentQueueLocationUuid?: string;
  currentServiceQueueUuid?: string;
  onBeforeQueueEntrySave?: () => boolean | Promise<boolean>;
  onQueueEntryAdded?: () => void | Promise<void>;
  patientUuid: string;
  requestedServiceName?: string;
}

/** Creates an administrative queue entry without inventing a clinical visit or visit location. */
const QueueOnlyForm: React.FC<QueueOnlyFormProps> = ({
  closeWorkspace,
  currentQueueLocationUuid,
  currentServiceQueueUuid,
  onBeforeQueueEntrySave,
  onQueueEntryAdded,
  patientUuid,
  requestedServiceName,
}) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const [callbacks, setCallbacks] = useState<QueueFieldsCallbacks | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateQueueEntries } = useMutateQueueEntries();

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!callbacks || !callbacks.onBeforeVisitSave()) {
        return;
      }

      setIsSubmitting(true);
      try {
        if (onBeforeQueueEntrySave && !(await onBeforeQueueEntrySave())) {
          return;
        }
        await callbacks.onVisitCreatedOrUpdated();
        await onQueueEntryAdded?.();
        closeWorkspace();
        mutateQueueEntries();
      } catch {
        // QueueFields reports the contextual error and leaves the form open for retry.
      } finally {
        setIsSubmitting(false);
      }
    },
    [callbacks, closeWorkspace, mutateQueueEntries, onBeforeQueueEntrySave, onQueueEntryAdded],
  );

  return (
    <Form className={styles.form} onSubmit={handleSubmit}>
      <QueueFields
        currentQueueLocationUuid={currentQueueLocationUuid}
        currentServiceQueueUuid={currentServiceQueueUuid}
        patientGender={patient?.gender}
        patientUuid={patientUuid}
        requestedServiceName={requestedServiceName}
        setCallbacks={setCallbacks}
        visitRequired={false}
      />
      <ButtonSet className={styles.desktopButtons}>
        <Button className={styles.button} kind="secondary" onClick={closeWorkspace} type="button">
          {t('discard', 'Discard')}
        </Button>
        <Button className={styles.button} disabled={isSubmitting || !callbacks} kind="primary" type="submit">
          {t('addPatientToQueue', 'Add patient to queue')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default QueueOnlyForm;
