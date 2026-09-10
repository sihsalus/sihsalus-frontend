import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader, Stack, TextInput } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCoreTranslation, showSnackbar } from '@openmrs/esm-framework';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

interface SaveDefinitionModalProps {
  kind: 'cohort' | 'query';
  closeModal: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

/** Both saved definitions have the same two required fields and asynchronous save contract. */
const SaveDefinitionModal: React.FC<SaveDefinitionModalProps> = ({ kind, closeModal, onSave }) => {
  const { t } = useTranslation();
  const isCohort = kind === 'cohort';
  const nameRequired = isCohort
    ? t('cohortNameRequired', 'Cohort name is required')
    : t('queryNameRequired', 'Name is required');
  const descriptionRequired = isCohort
    ? t('cohortDescriptionRequired', 'Description is required')
    : t('queryDescriptionRequired', 'Description is required');
  const schema = z.object({
    name: z.string().trim().min(1, nameRequired),
    description: z.string().trim().min(1, descriptionRequired),
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const closeWhenIdle = () => {
    if (!savingRef.current) closeModal();
  };

  const onSubmit = async ({ name, description }: z.infer<typeof schema>) => {
    // Cover rapid clicks and keyboard submits before React has disabled the button.
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(name, description);
    } catch {
      showSnackbar({
        kind: 'error',
        title: isCohort
          ? t('errorCreatingCohort', 'Error creating the cohort')
          : t('querySaveError', 'Error saving the query'),
        subtitle: t(
          'definitionSaveErrorMessage',
          'The save could not be confirmed. Your entries were kept. Verify the connection before trying again.',
        ),
      });
      return;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
    closeModal();
  };

  return (
    <div>
      <ModalHeader
        closeModal={closeWhenIdle}
        title={isCohort ? t('saveCohort', 'Save cohort') : t('saveQuery', 'Save query')}
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <Stack gap={5}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  id={`${kind}-name`}
                  data-testid={`${kind}-name`}
                  labelText={
                    isCohort
                      ? t('enterCohortName', 'Enter a cohort name')
                      : t('enterQueryName', 'Enter a name for the query')
                  }
                  disabled={isSaving}
                  invalid={!!errors.name}
                  invalidText={errors.name?.message}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  id={`${kind}-description`}
                  data-testid={`${kind}-description`}
                  labelText={
                    isCohort
                      ? t('enterCohortDescription', 'Enter a cohort description')
                      : t('enterQueryDescription', 'Enter a description of the query')
                  }
                  disabled={isSaving}
                  invalid={!!errors.description}
                  invalidText={errors.description?.message}
                />
              )}
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeWhenIdle} disabled={isSaving}>
            {getCoreTranslation('cancel')}
          </Button>
          <Button kind="primary" type="submit" disabled={isSaving}>
            {isSaving ? <InlineLoading description={t('saving', 'Saving')} /> : getCoreTranslation('save')}
          </Button>
        </ModalFooter>
      </form>
    </div>
  );
};

export default SaveDefinitionModal;
