import { Button, ButtonSet, Form, InlineNotification } from '@carbon/react';
import { isDesktop, useLayoutType, usePatient } from '@openmrs/esm-framework';
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
  const layout = useLayoutType();
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
    <Form aria-busy={isSubmitting} className={styles.form} onSubmit={handleSubmit}>
      <InlineNotification
        className={styles.workflowNotice}
        hideCloseButton
        kind="info"
        lowContrast
        title={t('administrativeQueueEntry', 'Administrative queue entry')}
        subtitle={t(
          'administrativeQueueEntryDescription',
          'The patient will be added to this queue without creating a clinical visit or queue number.',
        )}
      />
      <QueueFields
        currentQueueLocationUuid={currentQueueLocationUuid}
        currentServiceQueueUuid={currentServiceQueueUuid}
        patientGender={patient?.gender}
        patientUuid={patientUuid}
        requestedServiceName={requestedServiceName}
        setCallbacks={setCallbacks}
        visitRequired={false}
      />
      <ButtonSet className={isDesktop(layout) ? styles.desktopButtons : styles.tabletButtons}>
        <Button
          className={styles.button}
          disabled={isSubmitting}
          kind="secondary"
          onClick={closeWorkspace}
          type="button"
        >
          {t('discard', 'Discard')}
        </Button>
        <Button
          aria-busy={isSubmitting}
          className={styles.button}
          disabled={isSubmitting || !callbacks}
          kind="primary"
          type="submit"
        >
          {isSubmitting
            ? t('addingPatientToQueue', 'Adding patient to queue…')
            : t('addPatientToQueue', 'Add patient to queue')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default QueueOnlyForm;
