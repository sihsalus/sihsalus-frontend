import {
  Button,
  ButtonSet,
  Column,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  InlineLoading,
  Stack,
  Tile,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import type { z } from 'zod';
import useRelationship from '../../hooks/useRelationship';
import useRelationshipTypes from '../../hooks/useRelationshipTypes';
import type { FichaFamiliarWorkspaceProps } from '../../workspace-utils';
import PatientInfo from '../patient-info.component';
import { relationshipUpdateFormSchema, updateRelationship } from '../relationship.resources';

import styles from './form.scss';

interface RelationshipUpdateFormProps extends DefaultWorkspaceProps {
  groupProps?: { patientUuid?: string } | null;
  relationShipUuid?: string;
  patientUuid?: string;
  workspaceProps?: FichaFamiliarWorkspaceProps | null;
}

type RelationshipUpdateFormType = z.infer<typeof relationshipUpdateFormSchema>;

const RelationshipUpdateForm: React.FC<RelationshipUpdateFormProps> = ({
  closeWorkspace,
  groupProps,
  relationShipUuid,
  patientUuid,
  workspaceProps,
}) => {
  const resolvedRelationShipUuid = workspaceProps?.relationShipUuid ?? relationShipUuid ?? '';
  const resolvedPatientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid ?? patientUuid;
  const { error, isLoading, relationship } = useRelationship(resolvedRelationShipUuid);
  const { isLoading: typesLoading, error: typesError, relationshipTypes } = useRelationshipTypes();
  const { t } = useTranslation();
  const form = useForm<RelationshipUpdateFormType>({
    defaultValues: {
      endDate: relationship?.endDate ? new Date(relationship.endDate) : undefined,
      startDate: relationship?.startDate ? new Date(relationship.startDate) : undefined,
      relationshipType: relationship?.relationshipType?.uuid,
    },
    resolver: zodResolver(relationshipUpdateFormSchema),
  });

  useEffect(() => {
    if (relationship && !form.watch('endDate')) {
      if (relationship.endDate) {
        form.setValue('endDate', new Date(relationship.endDate));
      }
      if (relationship.startDate) {
        form.setValue('startDate', new Date(relationship.startDate));
      }
      if (relationship.relationshipType) {
        form.setValue('relationshipType', relationship.relationshipType.uuid);
      }
    }
  }, [form, relationship]);

  const onSubmit = async (values: RelationshipUpdateFormType) => {
    try {
      await updateRelationship(resolvedRelationShipUuid, values);
      closeWorkspace();
      showSnackbar({
        title: t('success', 'Success'),
        subtitle: t('relationshipUpdatedSuccessfully', 'Relationship updated successfully'),
        kind: 'success',
      });
      mutate((key) => {
        return typeof key === 'string' && key.startsWith('/ws/rest/v1/relationship');
      });
    } catch {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('failedUpdatingRelationship', 'Failed to update relationship'),
        kind: 'error',
      });
    }
  };

  if (isLoading || typesLoading) {
    return (
      <div className={styles.loading}>
        <InlineLoading
          status="active"
          iconDescription={t('loading', 'Loading...')}
          description={t('loadingForm', 'Loading form...')}
          style={{ justifyContent: 'center' }}
        />
      </div>
    );
  }

  if (error || typesError) {
    return (
      <div className={styles.error}>
        <Tile id="error">
          <strong>Error:</strong>
          <p>{error?.message ?? typesError?.message}</p>
        </Tile>
      </div>
    );
  }

  const relativeUuid =
    resolvedPatientUuid && relationship.personA?.uuid === resolvedPatientUuid
      ? relationship.personB?.uuid
      : relationship.personA?.uuid;

  const content = (
    <Form onSubmit={form.handleSubmit(onSubmit)}>
      <Stack gap={4} className={styles.grid}>
        <Column>
          <PatientInfo patientUuid={relativeUuid ?? relationship.personB.uuid} />
        </Column>
        <Column>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                dateFormat="d/m/Y"
                datePickerType="single"
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
                value={field.value}
                onChange={field.onChange}
                dateFormat="d/m/Y"
                datePickerType="single"
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
            control={form.control}
            name="relationshipType"
            render={({ field }) => (
              <Dropdown
                ref={field.ref}
                invalid={!!form.formState.errors[field.name]?.message}
                invalidText={form.formState.errors[field.name]?.message}
                id="relationship"
                titleText={t('relationshipType', 'Relationship Type')}
                onChange={(e) => {
                  field.onChange(e.selectedItem);
                }}
                selectedItem={field.value}
                label={t('chooseOption', 'Choose option')}
                items={relationshipTypes.map((r) => r.uuid)}
                itemToString={(item) => relationshipTypes.find((r) => r.uuid === item)?.displayBIsToA ?? ''}
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
          {t('submit', 'Submit')}
        </Button>
      </ButtonSet>
    </Form>
  );

  return workspaceProps ? (
    <Workspace2 title={workspaceProps.workspaceTitle ?? t('relationshipUpdateFormTitle', 'Editar relación')}>
      {content}
    </Workspace2>
  ) : (
    content
  );
};

export default RelationshipUpdateForm;
