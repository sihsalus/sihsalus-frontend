import { Button, ButtonSet, Column, ComboBox, Form, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { showSnackbar, useConfig, useSession, Workspace2 } from '@openmrs/esm-framework';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import type { ConfigObject } from '../config-schema';
import PatientSearchCreate from '../relationships/forms/patient-search-create-form.component';
import { relationshipFormSchema, saveRelationship } from '../relationships/relationship.resources';
import { uppercaseText } from '../utils/expression-helper';
import type { FichaFamiliarWorkspaceComponentProps } from '../workspace-utils';

import styles from './family-relationship.scss';
import { useMappedRelationshipTypes } from './relationships.resource';

const FamilyRelationshipForm: React.FC<FichaFamiliarWorkspaceComponentProps> = ({
  closeWorkspace,
  groupProps,
  patientUuid,
  workspaceProps,
}) => {
  const resolvedPatientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid ?? patientUuid ?? '';
  const { t } = useTranslation();
  const { data: mappedRelationshipTypes } = useMappedRelationshipTypes();
  const config = useConfig<ConfigObject>();
  const { familyRelationshipsTypeList } = config;
  const familyRelationshipTypesUUIDs = new Set(familyRelationshipsTypeList.map((r) => r.uuid));
  const familyRelationshipTypes = mappedRelationshipTypes.filter((type) => familyRelationshipTypesUUIDs.has(type.uuid));
  const session = useSession();
  const relationshipTypes = familyRelationshipTypes.map((relationship) => ({
    id: `${relationship.uuid}:${relationship.direction}`,
    direction: relationship.direction,
    uuid: relationship.uuid,
    text: relationship.display,
  }));

  type FormData = z.infer<typeof schema>;

  const schema = relationshipFormSchema
    .refine((data) => !(data.mode === 'search' && !data.personB), {
      message: t('required', 'Requerido'),
      path: ['personB'],
    })
    .refine((data) => !(data.mode === 'create' && !data.personBInfo), {
      path: ['personBInfo'],
      message: t('patientInformationRequired', 'Por favor proporcione la información del paciente'),
    })
    .refine(
      (data) => {
        if (!data.startDate) {
          return true;
        }
        const now = new Date();
        const start = new Date(data.startDate);
        return start <= now;
      },
      {
        message: t('futureDateNotAllowed', 'No puede ser una fecha en el futuro'),
        path: ['startDate'],
      },
    )
    .refine(
      (data) => {
        if (!data.startDate || !data.endDate) {
          return true;
        }
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      },
      {
        message: t('endDateBeforeStartDate', 'La fecha final no puede ser anterior a la fecha inicial'),
        path: ['endDate'],
      },
    );

  const form = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      personA: resolvedPatientUuid,
      mode: 'search',
    },
    resolver: zodResolver(schema),
  });

  const { control, handleSubmit } = form;

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      await saveRelationship(data, config, session, []);

      showSnackbar({
        isLowContrast: true,
        title: t('success', 'Éxito'),
        subtitle: t('relationshipSavedSuccessfully', 'La relación familiar se guardó exitosamente'),
        kind: 'success',
      });

      closeWorkspace();
    } catch (error) {
      console.error('Failed to save relationship:', error);

      showSnackbar({
        isLowContrast: false,
        title: t('error', 'Error'),
        subtitle: t('failedSavingRelationship', 'No se pudo guardar la relación familiar'),
        kind: 'error',
      });
    }
  };

  const content = (
    <FormProvider {...form}>
      <Form
        className={styles.form}
        onSubmit={handleSubmit(onSubmit)}
        onInvalid={(event) => {
          event.preventDefault();
          const fieldsWithError = Object.keys(form.formState.errors).join(', ');
          console.warn('Validation errors:', form.formState.errors);

          showSnackbar({
            title: t('validationError', 'Error de validación'),
            subtitle: t('formInvalidFields', 'Por favor revise los siguientes campos:') + ` ${fieldsWithError}`,
            kind: 'error',
          });
        }}
      >
        <Stack gap={5} className={styles.grid}>
          <PatientSearchCreate />

          <span className={styles.sectionHeader}>{t('familyRelationship', 'Relación Familiar')}</span>

          <Column>
            <Controller
              name="relationshipType"
              control={control}
              render={({ field, fieldState }) => (
                <ComboBox
                  id="relationship_name"
                  titleText={t('relationshipType', 'Tipo de relación')}
                  placeholder={t('selectRelationshipPlaceholder', 'Seleccione el tipo de relación con el paciente')}
                  items={relationshipTypes}
                  itemToString={(item) => (item ? uppercaseText(item.text) : '')}
                  onChange={(e) => {
                    field.onChange(e.selectedItem?.uuid);
                    form.setValue('relationshipDirection', e.selectedItem?.direction);
                  }}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                  selectedItem={relationshipTypes.find(
                    (item) =>
                      item.uuid === field.value &&
                      item.direction === form.watch('relationshipDirection', item.direction),
                  )}
                />
              )}
            />
          </Column>
          <Column>
            <div style={{ color: 'red', fontSize: '0.9em' }}>
              {Object.entries(form.formState.errors).map(([field, error]) => (
                <div key={field}>
                  {field}: {(error as { message?: string })?.message}
                </div>
              ))}
            </div>
          </Column>
        </Stack>

        <ButtonSet className={styles.buttonSet}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()} type="button">
            {t('cancel', 'Cancelar')}
          </Button>
          <Button className={styles.button} kind="primary" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t('saving', 'Guardando...') : t('saveRelationship', 'Guardar Relación')}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );

  return workspaceProps ? (
    <Workspace2
      title={workspaceProps.workspaceTitle ?? t('familyRelationshipFormTitle', 'Formulario de relación familiar')}
    >
      {content}
    </Workspace2>
  ) : (
    content
  );
};

export default FamilyRelationshipForm;
