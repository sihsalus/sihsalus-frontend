import { Button, ButtonSet, Column, ComboBox, DatePicker, DatePickerInput, Form, Stack, TextArea } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExtensionSlot, openmrsFetch, restBaseUrl, showSnackbar, useSession } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import useSWRImmutable from 'swr/immutable';
import { z } from 'zod';
import { extractNameString, uppercaseText } from '../../utils/expression-helper';

const useMappedRelationshipTypes = () => {
  const url = `${restBaseUrl}/relationshiptype?v=default`;
  const { data, error, isLoading } = useSWRImmutable<{
    data?: { results: Array<{ uuid: string; display: string; displayAIsToB: string; displayBIsToA: string }> };
  }>(url, openmrsFetch);

  const relations: Array<{ display: string; uuid: string; direction: string }> = [];
  data?.data?.results.forEach((type) => {
    const aIsToB = { display: type.displayAIsToB || type.displayBIsToA, uuid: type.uuid, direction: 'aIsToB' };
    const bIsToA = { display: type.displayBIsToA || type.displayAIsToB, uuid: type.uuid, direction: 'bIsToA' };
    if (aIsToB.display === bIsToA.display) {
      relations.push(aIsToB);
    } else if (bIsToA.display === 'Paciente') {
      relations.push(aIsToB, { display: `Paciente (${aIsToB.display})`, uuid: type.uuid, direction: 'bIsToA' });
    } else {
      relations.push(aIsToB, bIsToA);
    }
  });
  return { data: relations, error, isLoading };
};

import { saveRelationship, useActivecases, useCaseManagers } from './case-management.resource';
import styles from './case-management.scss';
import PatientInfo from './patient-info.component';

const schema = z.object({
  caseManager: z.string().nonempty({ message: 'Case Manager is required' }),
  relationship: z.string().nonempty({ message: 'Relationship is required' }),
  startDate: z.date({ required_error: 'Start Date is required' }),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type CaseManagementProp = {
  closeWorkspace: () => void;
};

const CaseManagementForm: React.FC<CaseManagementProp> = ({ closeWorkspace }) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const [patientUuid, setPatientUuid] = useState('');
  const [patientSelected, setPatientSelected] = useState(false);
  const { data } = useCaseManagers();
  const { data: relationshipTypes } = useMappedRelationshipTypes();

  const caseManagerRelationshipTypeMapped =
    relationshipTypes
      .filter((relationshipType) => /^Paciente/.test(relationshipType.display))
      ?.map((relationship) => ({
        id: relationship.uuid,
        text: relationship.display,
      })) || [];

  const caseManagerUuid = user?.person.uuid;
  const { mutate: fetchCases } = useActivecases(caseManagerUuid);

  const caseManagers =
    data?.data.results.map((manager) => ({
      id: manager.person.uuid,
      text: manager.display,
    })) || [];

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    const payload = {
      personA: data.caseManager,
      relationshipType: data.relationship,
      personB: patientUuid,
      startDate: data.startDate.toISOString(),
    };

    try {
      await saveRelationship(payload);
      await fetchCases();
      showSnackbar({
        kind: 'success',
        title: t('saveRlship', 'Save Relationship'),
        subtitle: t('savedRlship', 'Relationship saved successfully'),
        timeoutInMs: 3000,
        isLowContrast: true,
      });

      closeWorkspace();
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('RlshipError', 'Relationship Error'),
        subtitle: t('RlshipError', 'Request Failed.......'),
        timeoutInMs: 2500,
        isLowContrast: true,
      });
    }
  };

  const selectPatient = (patientUuid) => {
    setPatientUuid(patientUuid);
    setPatientSelected(true);
  };

  return (
    <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <span className={styles.caseFormTitle}>{t('formTitle', 'Fill in the form details')}</span>
      <Stack gap={4} className={styles.grid}>
        <span className={styles.sectionHeader}>{t('demographics', 'Demographics')}</span>

        <Column>
          <Controller
            name="caseManager"
            control={control}
            defaultValue={caseManagerUuid}
            render={({ field, fieldState }) => {
              return (
                <ComboBox
                  id="case_manager_name"
                  titleText={t('manager', 'Case Manager')}
                  placeholder={t('selectCaseManager', 'Select Case Manager')}
                  items={caseManagers}
                  itemToString={(item) => uppercaseText(extractNameString(item ? item.text : ''))}
                  onChange={(e) => {
                    field.onChange(e.selectedItem?.id);
                  }}
                  selectedItem={caseManagers.find((manager) => manager.id === field.value)}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                />
              );
            }}
          />
        </Column>

        <span className={styles.sectionHeader}>{t('relationshipInfo', 'Relationship Info')}</span>
        {patientSelected && <PatientInfo patientUuid={patientUuid} />}
        {!patientSelected && (
          <Column>
            <ExtensionSlot
              name="patient-search-bar-slot"
              state={{
                selectPatientAction: selectPatient,
                buttonProps: {
                  kind: 'primary',
                },
              }}
            />
          </Column>
        )}

        <Column>
          <Controller
            name="relationship"
            control={control}
            render={({ field, fieldState }) => (
              <ComboBox
                id="relationship_name"
                titleText={t('relationship', 'Relationship')}
                placeholder={t('selectRelationship', 'Select Relationship')}
                items={caseManagerRelationshipTypeMapped}
                itemToString={(item) => (item ? uppercaseText(item.text) : '')}
                onChange={(e) => field.onChange(e.selectedItem?.id)}
                invalid={!!fieldState.error}
                invalidText={fieldState.error?.message}
              />
            )}
          />
        </Column>

        <Column>
          <Controller
            name="startDate"
            control={control}
            render={({ field, fieldState }) => (
              <DatePicker
                datePickerType="single"
                onChange={(e) => field.onChange(e[0])}
                className={styles.formDatePicker}
              >
                <DatePickerInput
                  placeholder="dd/mm//aaaa"
                  labelText={t('startDate', 'Start Date')}
                  id="case-start-date-picker"
                  size="md"
                  className={styles.formDatePicker}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                />
              </DatePicker>
            )}
          />
        </Column>
        <Column className={styles.textbox}>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextArea
                labelText={t('additionalNotes', 'Any additional notes')}
                rows={4}
                id="case-manager-notes"
                {...field}
              />
            )}
          />
        </Column>
      </Stack>

      <ButtonSet className={styles.buttonSet}>
        <Button className={styles.button} kind="secondary" onClick={closeWorkspace}>
          {t('discard', 'Discard')}
        </Button>
        <Button className={styles.button} kind="primary" type="submit" disabled={!isValid || !patientSelected}>
          {t('save', 'Save')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default CaseManagementForm;
