import { Button, Column, Form, InlineLoading, InlineNotification, Row, Stack, TextArea } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getCoreTranslation,
  ResponsiveWrapper,
  showSnackbar,
  translateFrom,
  useConfig,
  userHasAccess,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { type WardConfigObject } from '../../config-schema';
import { moduleName, wardEditPrivilege } from '../../constant';
import useEmrConfiguration from '../../hooks/useEmrConfiguration';
import { type EncounterPayload, type WardPatientWorkspaceDefinition } from '../../types';
import WardPatientWorkspaceBanner from '../patient-banner/patient-banner.component';
import PatientNotesHistory from './history/notes-container.component';
import { createPatientNote, usePatientNotes } from './notes.resource';
import styles from './notes.scss';

type NotesFormData = z.infer<typeof noteFormSchema>;

const noteFormSchema = z.object({
  wardClinicalNote: z.string().refine((val) => val.trim().length > 0, {
    //t('clinicalNoteErrorMessage','Clinical note is required')
    message: translateFrom(moduleName, 'clinicalNoteErrorMessage', 'Clinical note is required'),
  }),
});

const WardPatientNotesWorkspace: React.FC<WardPatientWorkspaceDefinition> = ({
  groupProps: { wardPatient },
  closeWorkspace,
}) => {
  const patientUuid = wardPatient.patient.uuid;
  const visitUuid = wardPatient?.visit?.uuid;
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();
  const config = useConfig<WardConfigObject>();
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(wardEditPrivilege, session?.user);

  const { patientNotes, mutatePatientNotes, isLoadingPatientNotes, errorFetchingPatientNotes } = usePatientNotes(
    patientUuid,
    visitUuid,
    [emrConfiguration?.consultFreeTextCommentsConcept?.uuid, ...config.additionalInpatientNotesConceptUuids],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasEditChanges, setHasEditChanges] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<NotesFormData>({
    mode: 'onSubmit',
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      wardClinicalNote: '',
    },
  });

  const locationUuid =
    wardPatient.inpatientAdmission?.currentInpatientLocation?.uuid ?? wardPatient.visit?.location?.uuid;
  const providerUuid = session?.currentProvider?.uuid;

  const onSubmit = useCallback(
    (data: NotesFormData) => {
      if (!locationUuid || !providerUuid) {
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          subtitle: t('activeWardLocationRequired', 'The ward patient must have an operational location.'),
          title: t('patientNoteSaveError', 'Error saving patient note'),
        });
        return;
      }

      const { wardClinicalNote } = data;
      setIsSubmitting(true);

      const notePayload: EncounterPayload = {
        patient: patientUuid,
        location: locationUuid,
        visit: visitUuid,
        encounterType: emrConfiguration?.inpatientNoteEncounterType?.uuid,
        encounterProviders: [
          {
            encounterRole: emrConfiguration?.clinicianEncounterRole?.uuid,
            provider: providerUuid,
          },
        ],
        obs: wardClinicalNote
          ? [
              {
                concept: { uuid: emrConfiguration?.consultFreeTextCommentsConcept.uuid, display: '' },
                value: wardClinicalNote,
              },
            ]
          : [],
      };

      const abortController = new AbortController();

      createPatientNote(notePayload, abortController)
        .then(async () => {
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('patientNoteNowVisible', 'It should be now visible in the notes history'),
            title: t('visitNoteSaved', 'Patient note saved'),
          });
          mutatePatientNotes();
          await closeWorkspace({ discardUnsavedChanges: true });
        })
        .catch((err) => {
          showSnackbar({
            isLowContrast: false,
            kind: 'error',
            subtitle: err?.message,
            title: t('patientNoteSaveError', 'Error saving patient note'),
          });
        })
        .finally(() => setIsSubmitting(false));
    },
    [
      emrConfiguration?.clinicianEncounterRole?.uuid,
      emrConfiguration?.consultFreeTextCommentsConcept?.uuid,
      emrConfiguration?.inpatientNoteEncounterType?.uuid,
      locationUuid,
      mutatePatientNotes,
      patientUuid,
      providerUuid,
      t,
      closeWorkspace,
      visitUuid,
    ],
  );

  const onError = (errors) => console.error(errors);

  return (
    <Workspace2
      hasUnsavedChanges={isDirty || hasEditChanges}
      title={t('inpatientNotesWorkspaceTitle', 'In-patient notes')}
    >
      <WardPatientWorkspaceBanner {...{ wardPatient }} />
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit, onError)}>
        {errorFetchingEmrConfiguration && (
          <div className={styles.formError}>
            <InlineNotification
              kind="error"
              title={t('somePartsOfTheFormDidntLoad', "Some parts of the form didn't load")}
              subtitle={t(
                'fetchingEmrConfigurationFailed',
                'Fetching EMR configuration failed. Try refreshing the page or contact your system administrator.',
              )}
              lowContrast
              hideCloseButton
            />
          </div>
        )}
        {canEdit && (
          <Stack className={styles.formContainer} gap={4}>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t('note', 'Note')}</span>
              </Column>
              <Column sm={3}>
                <Controller
                  name="wardClinicalNote"
                  control={control}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <ResponsiveWrapper>
                      <TextArea
                        id="additionalNote"
                        invalid={!!errors.wardClinicalNote}
                        invalidText={errors.wardClinicalNote?.message}
                        labelText={t('clinicalNoteLabel', 'Write your notes')}
                        onBlur={onBlur}
                        onChange={(event) => {
                          onChange(event);
                        }}
                        placeholder={t('wardClinicalNotePlaceholder', 'Write any notes here')}
                        rows={6}
                        value={value}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
            </Row>

            <Button
              className={styles.saveButton}
              disabled={isSubmitting || isLoadingEmrConfiguration || errorFetchingEmrConfiguration}
              kind="primary"
              type="submit"
            >
              {isSubmitting ? (
                <InlineLoading description={t('saving', 'Saving...')} />
              ) : (
                <span>{getCoreTranslation('save')}</span>
              )}
            </Button>
          </Stack>
        )}
      </Form>

      <PatientNotesHistory
        patientNotes={patientNotes}
        mutatePatientNotes={mutatePatientNotes}
        isLoading={isLoadingPatientNotes || isLoadingEmrConfiguration}
        errorFetchingPatientNotes={errorFetchingPatientNotes}
        promptBeforeClosing={setHasEditChanges}
      />
    </Workspace2>
  );
};

export default WardPatientNotesWorkspace;
