import { Button, ButtonSet, Column, ComboBox, DatePicker, DatePickerInput, Form, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfig, useSession, Workspace2 } from '@openmrs/esm-framework';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import type { ConfigObject } from '../config-schema';
import { useMappedRelationshipTypes } from '../family-partner-history/relationships.resource';
import PatientSearchCreate from '../relationships/forms/patient-search-create-form.component';
import { relationshipFormSchema, saveRelationship } from '../relationships/relationship.resources';
import { uppercaseText } from '../utils/expression-helper';
import type { FichaFamiliarWorkspaceComponentProps } from '../workspace-utils';

import styles from './other-relationships.scss';

const schema = relationshipFormSchema
  .refine(
    (data) => {
      return !(data.mode === 'search' && !data.personB);
    },
    { message: 'Required', path: ['personB'] },
  )
  .refine(
    (data) => {
      return !(data.mode === 'create' && !data.personBInfo);
    },
    { path: ['personBInfo'], message: 'Please provide patient information' },
  );
type FormData = z.infer<typeof schema>;

export const OtherRelationshipsForm: React.FC<FichaFamiliarWorkspaceComponentProps> = ({
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
  const otherRelationshipTypes = mappedRelationshipTypes.filter((type) => !familyRelationshipTypesUUIDs.has(type.uuid));
  const session = useSession();
  const relationshipTypes = otherRelationshipTypes.map((relationship) => ({
    id: `${relationship.uuid}:${relationship.direction}`,
    direction: relationship.direction,
    uuid: relationship.uuid,
    text: relationship.display,
  }));

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
      closeWorkspace();
    } catch (error) {
      console.error('Failed to save relationship:', error);
    }
  };

  const content = (
    <FormProvider {...form}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Stack gap={5} className={styles.grid}>
          <PatientSearchCreate />
          <span className={styles.sectionHeader}>{t('relationship', 'Relationship')}</span>
          <Column>
            <Controller
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  className={styles.datePickerInput}
                  dateFormat="d/m/Y"
                  datePickerType="single"
                  {...field}
                  ref={undefined}
                  invalid={!!form.formState.errors[field.name]?.message}
                  invalidText={form.formState.errors[field.name]?.message}
                >
                  <DatePickerInput
                    id="startDate"
                    invalid={!!form.formState.errors[field.name]?.message}
                    invalidText={form.formState.errors[field.name]?.message}
                    placeholder="mm/dd/yyyy"
                    labelText={t('startDate', 'Start Date')}
                    size="lg"
                  />
                </DatePicker>
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  className={styles.datePickerInput}
                  dateFormat="d/m/Y"
                  datePickerType="single"
                  {...field}
                  ref={undefined}
                  invalid={!!form.formState.errors[field.name]?.message}
                  invalidText={form.formState.errors[field.name]?.message}
                >
                  <DatePickerInput
                    id="endDate"
                    invalid={!!form.formState.errors[field.name]?.message}
                    invalidText={form.formState.errors[field.name]?.message}
                    placeholder="mm/dd/yyyy"
                    labelText={t('endDate', 'End Date')}
                    size="lg"
                  />
                </DatePicker>
              )}
            />
          </Column>
          <Column>
            <Controller
              name="relationshipType"
              control={control}
              render={({ field, fieldState }) => (
                <ComboBox
                  id="relationship_name"
                  titleText={t('relationship', 'Relationship')}
                  placeholder={t('selectRelationship', 'Select Relationship')}
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
        </Stack>
        <ButtonSet className={styles.buttonSet}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()} type="button">
            {t('discard', 'Discard')}
          </Button>
          <Button className={styles.button} kind="primary" type="submit" disabled={form.formState.isSubmitting}>
            {t('save', 'Save')}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );

  return workspaceProps ? (
    <Workspace2
      title={workspaceProps.workspaceTitle ?? t('otherRelationshipFormTitle', 'Formulario de relación no familiar')}
    >
      {content}
    </Workspace2>
  ) : (
    content
  );
};
