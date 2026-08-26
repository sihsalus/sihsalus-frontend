import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import {
  getUserFacingErrorMessage,
  showSnackbar,
  useAbortController,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
  useVisit,
  Workspace2,
} from '@openmrs/esm-framework';
import type { PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { consultaExternaEditPrivilege } from '../utils/constants';
import { formatDeceasedName } from '../utils/utils';
import { createInstitutionalReferral, type ReferralDestination } from './institutional-referral.resource';
import styles from './institutional-referral-form.workspace.scss';

const OTHER_DESTINATION_CODE = '__OTHER__';

const specialtyOptions = [
  { uuid: '0902d11c-4db9-48e3-9130-c2a107d4c523', translationKey: 'pediatrics', defaultLabel: 'Pediatría' },
  { uuid: '8411199d-5914-4285-a962-71a0199bc6b4', translationKey: 'medicine', defaultLabel: 'Medicina' },
  { uuid: 'fba05733-88f9-459c-acd4-b4e844c24bb7', translationKey: 'surgery', defaultLabel: 'Cirugía' },
  {
    uuid: '8504de7b-31a1-4c21-8a0e-ce1e1cba895e',
    translationKey: 'gynecologyObstetrics',
    defaultLabel: 'Gineco-obstetricia',
  },
  { uuid: '7a8a6770-15e5-442e-b2e3-c9d71e3d93f0', translationKey: 'laboratory', defaultLabel: 'Laboratorio' },
  {
    uuid: 'c8869ab4-7de8-4d55-900a-f7e2862a9329',
    translationKey: 'diagnosticImaging',
    defaultLabel: 'Diagnóstico por imágenes',
  },
] as const;

export interface InstitutionalReferralWorkspaceProps {
  patientUuid?: string;
  visitUuid?: string;
  locationUuid?: string;
  onAfterSave?: () => unknown | Promise<unknown>;
}

type InstitutionalReferralWorkspaceComponentProps = InstitutionalReferralWorkspaceProps &
  Partial<PatientWorkspace2DefinitionProps<InstitutionalReferralWorkspaceProps, object>>;

const InstitutionalReferralWorkspaceForm: React.FC<InstitutionalReferralWorkspaceComponentProps> = (props) => {
  const { t } = useTranslation();
  const workspaceProps = props.workspaceProps ?? {};
  const patientUuid = props.patientUuid ?? props.groupProps?.patientUuid ?? workspaceProps.patientUuid;
  const requestedVisitUuid = props.visitUuid ?? workspaceProps.visitUuid;
  const requestedLocationUuid = props.locationUuid ?? workspaceProps.locationUuid;
  const onAfterSave = props.onAfterSave ?? workspaceProps.onAfterSave;
  const closeWorkspace = props.closeWorkspace ?? (() => Promise.resolve(true));
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const abortController = useAbortController();
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const { activeVisit, currentVisit, error: visitError, isLoading: isVisitLoading } = useVisit(patientUuid);
  const visit = currentVisit ?? activeVisit;

  const destinationOptions = useMemo(
    () => [
      ...config.referralDestinations,
      { renaesCode: OTHER_DESTINATION_CODE, name: t('otherHealthFacility', 'Otro establecimiento') },
    ],
    [config.referralDestinations, t],
  );
  const [destination, setDestination] = useState<ReferralDestination | null>(null);
  const [otherDestination, setOtherDestination] = useState('');
  const [specialtyUuid, setSpecialtyUuid] = useState('');
  const [otherSpecialty, setOtherSpecialty] = useState('');
  const [referralTypeUuid, setReferralTypeUuid] = useState('');
  const [patientConditionUuid, setPatientConditionUuid] = useState('');
  const [transportModeUuid, setTransportModeUuid] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerUuid = session?.currentProvider?.uuid;
  const visitUuid = requestedVisitUuid ?? visit?.uuid;
  const locationUuid = requestedLocationUuid ?? visit?.location?.uuid;
  const visitIsVerified = Boolean(
    visitUuid &&
      visit?.uuid === visitUuid &&
      visit.visitType?.uuid?.toLowerCase() === config.visitTypes.ambulatory.toLowerCase(),
  );
  const isOtherDestination = destination?.renaesCode === OTHER_DESTINATION_CODE;
  const isOtherSpecialty = specialtyUuid === config.concepts.referralOtherSpecialtyUuid;
  const resolvedDestination = destination
    ? isOtherDestination
      ? { renaesCode: '', name: otherDestination.trim() }
      : destination
    : null;
  const hasCompleteDestination = Boolean(resolvedDestination?.name.trim());
  const hasCompleteSpecialty = Boolean(specialtyUuid && (!isOtherSpecialty || otherSpecialty.trim()));
  const isDirty = Boolean(
    destination ||
      otherDestination.trim() ||
      specialtyUuid ||
      otherSpecialty.trim() ||
      referralTypeUuid ||
      patientConditionUuid ||
      transportModeUuid ||
      reason.trim(),
  );
  const canSubmit = Boolean(
    patientUuid &&
      visitIsVerified &&
      locationUuid &&
      providerUuid &&
      hasCompleteDestination &&
      hasCompleteSpecialty &&
      referralTypeUuid &&
      patientConditionUuid &&
      transportModeUuid &&
      reason.trim() &&
      !isSubmitting,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !patientUuid || !visitUuid || !locationUuid || !providerUuid || !resolvedDestination) return;

    setIsSubmitting(true);
    try {
      await createInstitutionalReferral(
        {
          patientUuid,
          visitUuid,
          locationUuid,
          providerUuid,
          encounterTypeUuid: config.encounterTypes.referralCounterReferral,
          encounterRoleUuid: config.referralEncounterRoleUuid,
          destination: resolvedDestination,
          referralTypeUuid,
          specialtyUuid,
          otherSpecialty: isOtherSpecialty ? otherSpecialty : undefined,
          patientConditionUuid,
          transportModeUuid,
          reason,
          concepts: {
            referralTypeUuid: config.concepts.referralTypeUuid,
            referralReasonUuid: config.concepts.referralReasonUuid,
            referralDestinationUuid: config.concepts.referralDestinationUuid,
            referralDestinationSpecialtyUuid: config.concepts.referralDestinationSpecialtyUuid,
            referralDestinationSpecialtyOtherUuid: config.concepts.referralDestinationSpecialtyOtherUuid,
            referralPatientConditionUuid: config.concepts.referralPatientConditionUuid,
            referralTransportModeUuid: config.concepts.referralTransportModeUuid,
          },
        },
        abortController,
      );
      await onAfterSave?.();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('referralCreated', 'Referencia registrada'),
        subtitle: resolvedDestination.name,
      });
      void closeWorkspace({ discardUnsavedChanges: true });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('referralCreateError', 'No se pudo registrar la referencia'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('referralCreateErrorMessage', 'Revise los datos e intente nuevamente.'),
          { logContext: 'Create institutional referral' },
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const patientName = patient ? formatDeceasedName(patient) : null;
  const clinicalContextUnavailable = Boolean(
    !patientUuid ||
      patientError ||
      visitError ||
      (!isPatientLoading && !patient) ||
      (!isVisitLoading && !visitIsVerified),
  );

  return (
    <Workspace2
      title={t('institutionalReferralSheetTitle', 'Hoja de Referencia Institucional')}
      hasUnsavedChanges={isDirty}
    >
      <Form className={styles.form} onSubmit={handleSubmit}>
        <Stack gap={6} className={styles.formContent}>
          <p className={styles.formIntro}>
            {t(
              'institutionalReferralIntro',
              'Registre solo los datos propios de la derivación. Identificación, visita, triaje, historia, diagnósticos, tratamiento y profesional se recuperan del registro clínico para la hoja imprimible.',
            )}
          </p>

          {clinicalContextUnavailable ? (
            <InlineNotification
              hideCloseButton
              kind="error"
              lowContrast
              title={t('referralClinicalContextError', 'No se pudo verificar la atención ambulatoria')}
              subtitle={t(
                'referralClinicalContextErrorMessage',
                'Recargue la historia y confirme que el paciente tenga una visita ambulatoria activa.',
              )}
            />
          ) : null}
          {!providerUuid ? (
            <InlineNotification
              hideCloseButton
              kind="error"
              lowContrast
              title={t('providerRequired', 'Profesional clínico requerido')}
              subtitle={t(
                'referralProviderRequiredMessage',
                'Su usuario debe estar vinculado a un profesional para registrar la referencia.',
              )}
            />
          ) : null}

          <section className={styles.formSection} aria-labelledby="referral-context-heading">
            <header className={styles.sectionHeader}>
              <h3 id="referral-context-heading" className={styles.sectionTitle}>
                {t('dataAlreadyRegistered', 'Datos ya registrados')}
              </h3>
              <p className={styles.sectionDescription}>
                {t('dataAlreadyRegisteredHelper', 'Se reutilizan automáticamente; no deben volver a escribirse.')}
              </p>
            </header>
            <dl className={styles.contextList}>
              <div>
                <dt>{t('patient', 'Paciente')}</dt>
                <dd>{patientName || t('loading', 'Cargando...')}</dd>
              </div>
              <div>
                <dt>{t('visit', 'Visita')}</dt>
                <dd>{visit?.startDatetime ? new Date(visit.startDatetime).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt>{t('originHealthFacility', 'Establecimiento de origen')}</dt>
                <dd>{session?.sessionLocation?.display ?? visit?.location?.display ?? '—'}</dd>
              </div>
              <div>
                <dt>{t('responsibleProfessional', 'Profesional responsable')}</dt>
                <dd>{session?.user?.person?.display ?? session?.currentProvider?.identifier ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.formSection} aria-labelledby="referral-destination-heading">
            <header className={styles.sectionHeader}>
              <h3 id="referral-destination-heading" className={styles.sectionTitle}>
                {t('referralDestinationSection', 'Destino de la referencia')}
              </h3>
              <p className={styles.sectionDescription}>
                {t(
                  'referralDestinationHelper',
                  'Seleccione el establecimiento y la especialidad que recibirá al paciente.',
                )}
              </p>
            </header>
            <Stack gap={5}>
              <ComboBox
                id="referral-destination"
                items={destinationOptions}
                itemToString={(item: ReferralDestination | null) =>
                  item
                    ? item.renaesCode === OTHER_DESTINATION_CODE
                      ? item.name
                      : `${item.renaesCode} — ${item.name}`
                    : ''
                }
                onChange={({ selectedItem }: { selectedItem: ReferralDestination | null }) =>
                  setDestination(selectedItem)
                }
                selectedItem={destination}
                titleText={t('referralDestination', 'Establecimiento destino')}
                helperText={t(
                  'referralDestinationCatalogHelper',
                  'Catálogo configurable de establecimientos de derivación',
                )}
              />
              {isOtherDestination ? (
                <TextInput
                  id="referral-other-destination"
                  labelText={t('otherHealthFacilityName', 'Nombre del establecimiento destino')}
                  maxLength={120}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOtherDestination(event.target.value)}
                  value={otherDestination}
                />
              ) : null}
              <Select
                id="referral-specialty"
                labelText={t('destinationSpecialty', 'Especialidad de destino')}
                value={specialtyUuid}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSpecialtyUuid(event.target.value)}
              >
                <SelectItem disabled hidden value="" text={t('selectAnOption', 'Seleccione una opción')} />
                {specialtyOptions.map((specialty) => (
                  <SelectItem
                    key={specialty.uuid}
                    value={specialty.uuid}
                    text={t(specialty.translationKey, specialty.defaultLabel)}
                  />
                ))}
                <SelectItem value={config.concepts.referralOtherSpecialtyUuid} text={t('other', 'Otro')} />
              </Select>
              {isOtherSpecialty ? (
                <TextInput
                  id="referral-other-specialty"
                  labelText={t('specifyDestinationSpecialty', 'Especifique la especialidad')}
                  maxLength={80}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOtherSpecialty(event.target.value)}
                  value={otherSpecialty}
                />
              ) : null}
            </Stack>
          </section>

          <section className={styles.formSection} aria-labelledby="referral-transfer-heading">
            <header className={styles.sectionHeader}>
              <h3 id="referral-transfer-heading" className={styles.sectionTitle}>
                {t('referralTransferSection', 'Condiciones de la referencia y traslado')}
              </h3>
              <p className={styles.sectionDescription}>
                {t(
                  'referralTransferHelper',
                  'Complete la prioridad, condición de salida, transporte y motivo clínico.',
                )}
              </p>
            </header>
            <Stack gap={5}>
              <RadioButtonGroup
                legendText={t('referralPriority', 'Prioridad de la referencia')}
                name="referral-priority"
                orientation={isTablet ? 'vertical' : 'horizontal'}
                valueSelected={referralTypeUuid}
                onChange={(value: string) => setReferralTypeUuid(value)}
              >
                <RadioButton
                  id="referral-emergency"
                  labelText={t('emergency', 'Emergencia')}
                  value={config.concepts.referralEmergencyUuid}
                />
                <RadioButton
                  id="referral-urgent"
                  labelText={t('urgent', 'Urgencia')}
                  value={config.concepts.referralUrgencyUuid}
                />
                <RadioButton
                  id="referral-elective"
                  labelText={t('elective', 'Electiva')}
                  value={config.concepts.referralElectiveUuid}
                />
              </RadioButtonGroup>
              <RadioButtonGroup
                legendText={t('patientConditionAtDeparture', 'Condición del paciente a la salida')}
                name="referral-patient-condition"
                orientation={isTablet ? 'vertical' : 'horizontal'}
                valueSelected={patientConditionUuid}
                onChange={(value: string) => setPatientConditionUuid(value)}
              >
                <RadioButton
                  id="referral-stable"
                  labelText={t('stable', 'Estable')}
                  value={config.concepts.referralPatientStableUuid}
                />
                <RadioButton
                  id="referral-poor-condition"
                  labelText={t('poorCondition', 'Mal estado')}
                  value={config.concepts.referralPatientPoorConditionUuid}
                />
              </RadioButtonGroup>
              <RadioButtonGroup
                legendText={t('transportMode', 'Transporte')}
                name="referral-transport"
                orientation={isTablet ? 'vertical' : 'horizontal'}
                valueSelected={transportModeUuid}
                onChange={(value: string) => setTransportModeUuid(value)}
              >
                <RadioButton
                  id="referral-land"
                  labelText={t('landTransport', 'Terrestre')}
                  value={config.concepts.referralLandTransportUuid}
                />
                <RadioButton
                  id="referral-air"
                  labelText={t('airTransport', 'Aéreo')}
                  value={config.concepts.referralAirTransportUuid}
                />
                <RadioButton
                  id="referral-river"
                  labelText={t('riverTransport', 'Fluvial')}
                  value={config.concepts.referralRiverTransportUuid}
                />
              </RadioButtonGroup>
              <TextArea
                id="referral-reason"
                labelText={t('referralReason', 'Motivo de referencia')}
                helperText={t(
                  'referralReasonHelper',
                  'Explique la necesidad de atención en el establecimiento destino.',
                )}
                maxCount={500}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)}
                rows={5}
                value={reason}
              />
            </Stack>
          </section>

          <InlineNotification
            hideCloseButton
            kind="info"
            lowContrast
            title={t('manualReferralFields', 'Campos reservados para el documento impreso')}
            subtitle={t(
              'manualReferralFieldsHelper',
              'Responsable de la referencia, responsable del establecimiento, personal que acompaña, personal que recibe, firmas y sellos se dejan en blanco para completarse manualmente.',
            )}
          />
        </Stack>
        <ButtonSet className={isTablet ? `${styles.buttonSet} ${styles.tabletButtonSet}` : styles.buttonSet}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancelar')}
          </Button>
          <Button className={styles.button} disabled={!canSubmit} kind="primary" type="submit">
            {isSubmitting ? t('saving', 'Guardando...') : t('registerReferral', 'Registrar referencia')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

const InstitutionalReferralWorkspace: React.FC<InstitutionalReferralWorkspaceComponentProps> = (props) => (
  <RequirePrivilege privilege={consultaExternaEditPrivilege}>
    <InstitutionalReferralWorkspaceForm {...props} />
  </RequirePrivilege>
);

export default InstitutionalReferralWorkspace;
