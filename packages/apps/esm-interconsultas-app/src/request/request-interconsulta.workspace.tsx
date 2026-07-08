import {
  Button,
  ButtonSet,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Form,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
} from '@carbon/react';
import {
  showSnackbar,
  useAbortController,
  useConfig,
  useLayoutType,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import {
  createInterconsulta,
  useAvailableProviders,
  useDestinationServices,
  useInvalidateInterconsultas,
} from '../interconsultas.resource';
import type { OpenmrsRef, OrderableService } from '../types';
import styles from './request-interconsulta.scss';

export interface RequestInterconsultaWorkspaceProps {
  patientUuid?: string;
  closeWorkspace(options?: { ignoreChanges?: boolean }): void;
  promptBeforeClosing?: (testFcn: () => boolean) => void;
}

type Urgency = 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';

/**
 * Solicitud de interconsulta desde el chart del paciente / consulta externa.
 * Solo captura los datos propios de la interconsulta (servicio destino,
 * prioridad, motivo, fecha programada); paciente, visita, profesional y
 * location salen de la sesión y la visita activa.
 */
const RequestInterconsultaWorkspace: React.FC<RequestInterconsultaWorkspaceProps> = ({
  patientUuid,
  closeWorkspace,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const config = useConfig<ConfigObject>();
  const { currentVisit } = useVisit(patientUuid);
  const abortController = useAbortController();
  const invalidateInterconsultas = useInvalidateInterconsultas();

  const [searchTerm, setSearchTerm] = useState('');
  const [providerSearchTerm, setProviderSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<OpenmrsRef | null>(null);
  const [service, setService] = useState<OrderableService | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('ROUTINE');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSessionProvider = Boolean(session?.currentProvider?.uuid);
  const { services, isLoading: isLoadingServices } = useDestinationServices(searchTerm);
  const { providers, isLoading: isLoadingProviders } = useAvailableProviders(providerSearchTerm, !hasSessionProvider);

  const isDirty = Boolean(selectedProvider || service || motivo.trim());
  promptBeforeClosing?.(() => isDirty);

  const providerUuid = session?.currentProvider?.uuid ?? selectedProvider?.uuid;
  const locationUuid = currentVisit?.location?.uuid ?? session?.sessionLocation?.uuid;
  const canSubmit =
    Boolean(patientUuid && providerUuid && locationUuid && service && motivo.trim()) &&
    (urgency !== 'ON_SCHEDULED_DATE' || Boolean(scheduledDate)) &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !service || !patientUuid || !providerUuid || !locationUuid) {
      return;
    }
    setIsSubmitting(true);
    try {
      await createInterconsulta(
        {
          patientUuid,
          visitUuid: currentVisit?.uuid,
          locationUuid,
          providerUuid,
          serviceConceptUuid: service.uuid,
          urgency,
          scheduledDate: scheduledDate ?? undefined,
          motivo: motivo.trim(),
          config,
        },
        abortController,
      );
      invalidateInterconsultas();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('interconsultaCreated', 'Interconsulta solicitada'),
        subtitle: service.display,
      });
      closeWorkspace({ ignoreChanges: true });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorCreatingInterconsulta', 'Error al solicitar la interconsulta'),
        subtitle: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form className={styles.form} onSubmit={handleSubmit}>
      <Stack gap={5} className={styles.formContent}>
        {!currentVisit && (
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t('noActiveVisit', 'Sin visita activa')}
            subtitle={t(
              'noActiveVisitSubtitle',
              'La solicitud se registrará fuera de una visita. Se recomienda iniciar la visita primero.',
            )}
          />
        )}
        {!hasSessionProvider && (
          <ComboBox
            id="interconsulta-provider"
            items={providers}
            itemToString={(item: OpenmrsRef | null) => item?.display ?? ''}
            onChange={({ selectedItem }: { selectedItem: OpenmrsRef | null }) => setSelectedProvider(selectedItem)}
            onInputChange={(input: string) => setProviderSearchTerm(input ?? '')}
            placeholder={t('searchProvider', 'Buscar profesional...')}
            titleText={t('requestedBy', 'Solicitante')}
            helperText={isLoadingProviders ? t('loading', 'Cargando...') : t('providerRequired', 'Requerido')}
          />
        )}
        <ComboBox
          id="interconsulta-service"
          items={services}
          itemToString={(item: OrderableService | null) => item?.display ?? ''}
          onChange={({ selectedItem }: { selectedItem: OrderableService | null }) => setService(selectedItem)}
          onInputChange={(input: string) => setSearchTerm(input ?? '')}
          placeholder={t('searchService', 'Buscar servicio o especialidad...')}
          titleText={t('destinationService', 'Servicio destino')}
          helperText={
            isLoadingServices ? t('loading', 'Cargando...') : t('destinationServiceHelper', 'Mínimo 2 caracteres')
          }
        />
        <RadioButtonGroup
          legendText={t('priority', 'Prioridad')}
          name="interconsulta-urgency"
          orientation="vertical"
          valueSelected={urgency}
          onChange={(value: Urgency) => setUrgency(value)}
        >
          <RadioButton id="urgency-routine" labelText={t('urgencyRoutine', 'Rutina')} value="ROUTINE" />
          <RadioButton id="urgency-stat" labelText={t('urgencyStat', 'Urgente')} value="STAT" />
          <RadioButton
            id="urgency-scheduled"
            labelText={t('urgencyScheduled', 'Programada')}
            value="ON_SCHEDULED_DATE"
          />
        </RadioButtonGroup>
        {urgency === 'ON_SCHEDULED_DATE' && (
          <DatePicker
            datePickerType="single"
            minDate={new Date()}
            onChange={(dates: Array<Date>) => setScheduledDate(dates?.[0] ?? null)}
          >
            <DatePickerInput
              id="interconsulta-scheduled-date"
              labelText={t('scheduledDate', 'Fecha programada')}
              placeholder="dd/mm/aaaa"
            />
          </DatePicker>
        )}
        <TextArea
          id="interconsulta-motivo"
          labelText={t('reasonForRequest', 'Motivo')}
          helperText={t('reasonHelper', 'Motivo clínico de la interconsulta. No repita datos del paciente.')}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setMotivo(event.target.value)}
          rows={4}
          value={motivo}
        />
      </Stack>
      <ButtonSet className={isTablet ? `${styles.buttonSet} ${styles.tabletButtonSet}` : styles.buttonSet}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button className={styles.button} kind="primary" type="submit" disabled={!canSubmit}>
          {t('requestInterconsulta', 'Solicitar interconsulta')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default RequestInterconsultaWorkspace;
