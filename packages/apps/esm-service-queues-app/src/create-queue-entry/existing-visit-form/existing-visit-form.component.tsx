import { Button, ButtonSet, Form, InlineNotification, Row } from '@carbon/react';
import { ExtensionSlot, isDesktop, useLayoutType, usePatient, type Visit } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutateQueueEntries } from '../../hooks/useQueueEntries';
import QueueFields, { type QueueFieldsCallbacks } from '../queue-fields/queue-fields.component';

import styles from './existing-visit-form.scss';

interface ExistingVisitFormProps {
  closeWorkspace: () => void;
  currentQueueLocationUuid?: string;
  currentServiceQueueUuid?: string;
  onBeforeQueueEntrySave?: (visit: Visit) => boolean | Promise<boolean>;
  onQueueEntryAdded?: () => void | Promise<void>;
  requestedServiceName?: string;
  visit: Visit;
}

/**
 * This is the form that appears when clicking on a search result in the "Add patient to queue" workspace,
 * when the patient already has an active visit.
 */
const ExistingVisitForm: React.FC<ExistingVisitFormProps> = ({
  visit,
  closeWorkspace,
  currentQueueLocationUuid,
  currentServiceQueueUuid,
  onBeforeQueueEntrySave,
  onQueueEntryAdded,
  requestedServiceName,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const { patient } = usePatient(visit.patient?.uuid);
  const patientGender =
    (patient as { gender?: string } | undefined)?.gender ?? (visit.patient as { gender?: string } | undefined)?.gender;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutateQueueEntries } = useMutateQueueEntries();
  const [callbacks, setCallbacks] = useState<QueueFieldsCallbacks | null>(null);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!callbacks || !(await callbacks.onBeforeVisitSave())) {
        return;
      }

      setIsSubmitting(true);

      try {
        if (onBeforeQueueEntrySave && !(await onBeforeQueueEntrySave(visit))) {
          return;
        }

        await callbacks.onVisitCreatedOrUpdated(visit);
        closeWorkspace();
        mutateQueueEntries();
      } catch {
        // The callback that failed reports a contextual, user-facing error and leaves the form open.
      } finally {
        setIsSubmitting(false);
      }
    },
    [callbacks, closeWorkspace, visit, mutateQueueEntries, onBeforeQueueEntrySave],
  );

  return visit ? (
    <>
      {isTablet && (
        <Row className={styles.headerGridRow}>
          <ExtensionSlot
            name="visit-form-header-slot"
            className={styles.dataGridRow}
            state={{ patientUuid: visit.patient.uuid }}
          />
        </Row>
      )}
      <Form aria-busy={isSubmitting} className={classNames(styles.form, styles.container)} onSubmit={handleSubmit}>
        <InlineNotification
          className={styles.workflowNotice}
          hideCloseButton
          kind="info"
          lowContrast
          title={t('activeVisitQueueEntry', 'Active clinical visit')}
          subtitle={t(
            'activeVisitQueueEntryDescription',
            'The patient will be added to the queue using the active visit; a new visit will not be created.',
          )}
        />
        <QueueFields
          currentQueueLocationUuid={currentQueueLocationUuid}
          currentServiceQueueUuid={currentServiceQueueUuid}
          patientGender={patientGender}
          requestedServiceName={requestedServiceName}
          onQueueEntryAdded={onQueueEntryAdded}
          setCallbacks={setCallbacks}
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
    </>
  ) : null;
};

export default ExistingVisitForm;
