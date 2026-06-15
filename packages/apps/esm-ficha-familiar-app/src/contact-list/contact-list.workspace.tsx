import {
  Button,
  ButtonSet,
  Checkbox,
  Column,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DefaultWorkspaceProps } from '@openmrs/esm-framework';
import { useConfig, useSession, Workspace2 } from '@openmrs/esm-framework';
import React, { useEffect, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import type { ConfigObject } from '../config-schema';
import { useMappedRelationshipTypes } from '../family-partner-history/relationships.resource';
import PatientSearchCreate from '../relationships/forms/patient-search-create-form.component';
import type { FichaFamiliarWorkspaceProps } from '../workspace-utils';
import {
  BOOLEAN_NO,
  BOOLEAN_YES,
  ContactListFormSchema,
  contactipvOutcomeOptions,
  saveContact,
} from './contact-list.resource';
import styles from './contact-list-form.scss';

interface ContactListFormProps extends DefaultWorkspaceProps {
  groupProps?: { patientUuid?: string } | null;
  patientUuid?: string;
  props: Record<string, unknown>;
  workspaceProps?: FichaFamiliarWorkspaceProps | null;
}

type ContactListFormType = z.infer<typeof ContactListFormSchema>;

const ContactListForm: React.FC<ContactListFormProps> = ({
  closeWorkspace,
  closeWorkspaceWithSavedChanges: _closeWorkspaceWithSavedChanges,
  groupProps,
  promptBeforeClosing: _promptBeforeClosing,
  patientUuid,
  workspaceProps,
}) => {
  const resolvedPatientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid ?? patientUuid ?? '';
  const form = useForm<ContactListFormType>({
    mode: 'all',
    defaultValues: {
      personA: resolvedPatientUuid,
      mode: 'search',
    },
    resolver: zodResolver(ContactListFormSchema),
  });
  const { t } = useTranslation();
  const session = useSession();

  const config = useConfig<ConfigObject>();
  const { data } = useMappedRelationshipTypes();
  const pnsRelationshipTypes = data
    ? data
        .filter((relationship) => config.pnsRelationships.some((rel) => rel.uuid === relationship.uuid))
        .map((relationship) => ({
          id: `${relationship.uuid}:${relationship.direction}`,
          uuid: relationship.uuid,
          direction: relationship.direction,
          display: relationship.display,
        }))
    : [];

  const onSubmit = async (values: ContactListFormType) => {
    try {
      await saveContact(values, config, session);
      closeWorkspace();
    } catch {
      /* empty */
    }
  };

  const hivStatus = useMemo(
    () =>
      Object.entries(config.contactListConceptMap[config.concepts.partnerHivStatusConceptUuid]?.answers ?? {}).map(
        ([uuid, display]) => ({
          label: display,
          value: uuid,
        }),
      ),
    [config.concepts.partnerHivStatusConceptUuid, config.contactListConceptMap],
  );

  const pnsAproach = useMemo(
    () =>
      Object.entries(config.contactListConceptMap[config.concepts.pnsApproachConceptUuid]?.answers ?? {}).map(
        ([uuid, display]) => ({
          label: display,
          value: uuid,
        }),
      ),
    [config.concepts.pnsApproachConceptUuid, config.contactListConceptMap],
  );

  const contactLivingWithPatient = useMemo(
    () =>
      Object.entries(config.contactListConceptMap[config.concepts.livingWithPatientConceptUuid]?.answers ?? {}).map(
        ([uuid, display]) => ({
          label: display,
          value: uuid,
        }),
      ),
    [config.concepts.livingWithPatientConceptUuid, config.contactListConceptMap],
  );

  const observableRelationship = form.watch('relationshipType');
  const observablePhysicalAssault = form.watch('physicalAssault');
  const observableThreatened = form.watch('threatened');
  const observableSexualAssault = form.watch('sexualAssault');
  const observableMode = form.watch('mode');
  const showIPVRelatedFields =
    config.pnsRelationships.findIndex((r) => r.uuid === observableRelationship && r.sexual) !== -1;

  useEffect(() => {
    if ([observablePhysicalAssault, observableThreatened, observableSexualAssault].includes(BOOLEAN_YES)) {
      form.setValue('ipvOutcome', 'True');
    } else if (
      [observablePhysicalAssault, observableThreatened, observableSexualAssault].every((v) => v === BOOLEAN_NO)
    ) {
      form.setValue('ipvOutcome', 'False');
    }
    if (!showIPVRelatedFields) {
      form.setValue('ipvOutcome', undefined);
    }
  }, [observablePhysicalAssault, observableThreatened, observableSexualAssault, form, showIPVRelatedFields]);

  const content = (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <Stack gap={4} className={styles.grid}>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('privacyNoticeTitle', 'Protección de datos personales')}
            subtitle={t(
              'privacyNoticeSubtitle',
              'Los datos de salud registrados son datos sensibles según la Ley N° 29733 y su reglamento (D.S. 003-2013-JUS). Solo pueden ser tratados con consentimiento expreso del titular.',
            )}
          />
          <PatientSearchCreate />
          <span className={styles.sectionHeader}>{t('relationship', 'Relationship')}</span>
          <Column>
            <Controller
              control={form.control}
              name="startDate"
              render={({ field, fieldState: { error } }) => (
                <DatePicker
                  className={styles.datePickerInput}
                  dateFormat="d/m/Y"
                  datePickerType="single"
                  onChange={(date) => {
                    field.onChange(date[0]);
                  }}
                  invalid={!!error}
                  invalidText={error?.message}
                >
                  <DatePickerInput
                    id={`startdate-input`}
                    invalid={!!error}
                    invalidText={error?.message}
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
              render={({ field, fieldState: { error } }) => (
                <DatePicker
                  className={styles.datePickerInput}
                  dateFormat="d/m/Y"
                  datePickerType="single"
                  onChange={(date) => {
                    field.onChange(date[0]);
                  }}
                  invalid={!!error}
                  invalidText={error?.message}
                >
                  <DatePickerInput
                    id="enddate-input"
                    invalid={!!error}
                    invalidText={error?.message}
                    placeholder="dd/mm/yyyy"
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
              render={({ field, fieldState: { error } }) => (
                <Dropdown
                  ref={field.ref}
                  invalid={!!error}
                  invalidText={error?.message}
                  id="relationshipToPatient"
                  titleText={t('relationToPatient', 'Relation to patient')}
                  onChange={(e) => {
                    field.onChange(e.selectedItem?.uuid);
                    form.setValue('relationshipDirection', e.selectedItem?.direction);
                  }}
                  selectedItem={pnsRelationshipTypes.find(
                    (item) =>
                      item.uuid === field.value &&
                      item.direction === form.watch('relationshipDirection', item.direction),
                  )}
                  label={t('selectRelationship', 'Select Relationship')}
                  items={pnsRelationshipTypes}
                  itemToString={(item) => item?.display ?? ''}
                />
              )}
            />
          </Column>
          {observableMode === 'create' && (
            <>
              <Column>
                <Controller
                  control={form.control}
                  name="livingWithClient"
                  render={({ field, fieldState: { error } }) => (
                    <Dropdown
                      ref={field.ref}
                      invalid={!!error}
                      invalidText={error?.message}
                      id="livingWithClient"
                      titleText={t('livingWithClient', 'Living with client')}
                      onChange={(e) => {
                        field.onChange(e.selectedItem);
                      }}
                      initialSelectedItem={field.value}
                      label={t('select', 'Select')}
                      items={contactLivingWithPatient.map((r) => r.value)}
                      itemToString={(item) => contactLivingWithPatient.find((r) => r.value === item)?.label ?? ''}
                    />
                  )}
                />
              </Column>
              {showIPVRelatedFields && (
                <>
                  <span className={styles.sectionHeader}>{t('ipvQuestions', 'IPV Questions')}</span>
                  <Column>
                    <Controller
                      control={form.control}
                      name="physicalAssault"
                      render={({ field, fieldState: { error } }) => (
                        <RadioButtonGroup
                          id="physicalAssault"
                          legendText={t(
                            'physicalAssault',
                            '1. Has he/she ever hit, kicked, slapped, or otherwise physically hurt you?',
                          )}
                          {...field}
                          invalid={!!error}
                          invalidText={error?.message}
                          className={styles.billingItem}
                        >
                          <RadioButton labelText={t('yes', 'Yes')} value={BOOLEAN_YES} id="physicalAssault_yes" />
                          <RadioButton labelText={t('no', 'No')} value={BOOLEAN_NO} id="physicalAssault_no" />
                        </RadioButtonGroup>
                      )}
                    />
                  </Column>
                  <Column>
                    <Controller
                      control={form.control}
                      name="threatened"
                      render={({ field, fieldState: { error } }) => (
                        <RadioButtonGroup
                          id="threatened"
                          legendText={t('threatened', '2. Has he/she ever threatened to hurt you?')}
                          {...field}
                          invalid={!!error}
                          invalidText={error?.message}
                          className={styles.billingItem}
                        >
                          <RadioButton labelText={t('yes', 'Yes')} value={BOOLEAN_YES} id="threatened_yes" />
                          <RadioButton labelText={t('no', 'No')} value={BOOLEAN_NO} id="threatened_no" />
                        </RadioButtonGroup>
                      )}
                    />
                  </Column>
                  <Column>
                    <Controller
                      control={form.control}
                      name="sexualAssault"
                      render={({ field, fieldState: { error } }) => (
                        <RadioButtonGroup
                          id="sexualAssault"
                          legendText={t(
                            'sexualAssault',
                            '3.Has he/she ever forced you to do something sexually that made you feel uncomfortable?',
                          )}
                          {...field}
                          invalid={!!error}
                          invalidText={error?.message}
                          className={styles.billingItem}
                        >
                          <RadioButton labelText={t('yes', 'Yes')} value={BOOLEAN_YES} id="sexualAssault_yes" />
                          <RadioButton labelText={t('no', 'No')} value={BOOLEAN_NO} id="sexualAssault_no" />
                        </RadioButtonGroup>
                      )}
                    />
                  </Column>
                  <span className={styles.sectionHeader}>{t('ipvOutcome', 'IPV Outcome')}</span>
                  <Column>
                    <Controller
                      control={form.control}
                      name="ipvOutcome"
                      render={({ field, fieldState: { error } }) => (
                        <Dropdown
                          ref={field.ref}
                          invalid={!!error}
                          invalidText={error?.message}
                          id="ipvOutcome"
                          titleText={t('ipvOutcome', 'IPV Outcome')}
                          onChange={(e) => {
                            field.onChange(e.selectedItem);
                          }}
                          selectedItem={field.value}
                          label={t('chooseOption', 'Choose option')}
                          items={contactipvOutcomeOptions.map((r) => r.value)}
                          itemToString={(item) => {
                            return contactipvOutcomeOptions.find((r) => r.value === item)?.label ?? '';
                          }}
                        />
                      )}
                    />
                  </Column>
                </>
              )}
              <span className={styles.sectionHeader}>{t('baselineInformation', 'Baseline Information')}</span>
              <Column>
                <Controller
                  control={form.control}
                  name="baselineStatus"
                  render={({ field, fieldState: { error } }) => (
                    <Dropdown
                      ref={field.ref}
                      invalid={!!error}
                      invalidText={error?.message}
                      id="baselineStatus"
                      titleText={t('baselineStatus', 'HIV Status')}
                      onChange={(e) => {
                        field.onChange(e.selectedItem);
                      }}
                      initialSelectedItem={field.value}
                      label={t('selectHivStatus', 'Select HIV Status')}
                      items={hivStatus.map((r) => r.value)}
                      itemToString={(item) => hivStatus.find((r) => r.value === item)?.label ?? ''}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="preferedPNSAproach"
                  render={({ field, fieldState: { error } }) => (
                    <Dropdown
                      ref={field.ref}
                      invalid={!!error}
                      invalidText={error?.message}
                      id="preferedPNSAproach"
                      titleText={t('preferedPNSAproach', 'Prefered PNS Aproach')}
                      onChange={(e) => {
                        field.onChange(e.selectedItem);
                      }}
                      initialSelectedItem={field.value}
                      label={t('selectPnsApproach', 'Select PNS Approach')}
                      items={pnsAproach.map((r) => r.value)}
                      itemToString={(item) => pnsAproach.find((r) => r.value === item)?.label ?? ''}
                    />
                  )}
                />
              </Column>
            </>
          )}
          <span className={styles.sectionHeader}>{t('dataProtection', 'Consentimiento (Ley 29733)')}</span>
          <Column>
            <Controller
              control={form.control}
              name="dataConsent"
              render={({ field, fieldState: { error } }) => (
                <>
                  <Checkbox
                    id="dataConsent"
                    labelText={t(
                      'dataConsentLabel',
                      'El titular autoriza el registro y tratamiento de sus datos personales de salud para fines de atención sanitaria, según la Ley N° 29733 — Protección de Datos Personales.',
                    )}
                    checked={field.value ?? false}
                    onChange={(_, { checked }) => field.onChange(checked)}
                  />
                  {error && (
                    <p style={{ color: '#da1e28', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error.message}</p>
                  )}
                </>
              )}
            />
          </Column>
        </Stack>

        <ButtonSet className={styles.buttonSet}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button className={styles.button} kind="primary" type="submit" disabled={form.formState.isSubmitting}>
            {t('submit', 'Submit')}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );

  return workspaceProps ? (
    <Workspace2 title={workspaceProps.workspaceTitle ?? t('sexualContactForm', 'Formulario de contactos sexuales')}>
      {content}
    </Workspace2>
  ) : (
    content
  );
};

export default ContactListForm;
