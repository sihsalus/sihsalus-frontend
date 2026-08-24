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
  TextInput,
} from '@carbon/react';
import {
  getUserFacingErrorMessage,
  showSnackbar,
  useAbortController,
  useConfig,
  useLayoutType,
  useSession,
  useVisit,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type OrderBasketItem,
  type PatientWorkspace2DefinitionProps,
  useOrderBasket,
} from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { interconsultasChartEditPrivilege } from '../constants';
import { createInterconsulta, useDestinationServices, useInvalidateInterconsultas } from '../interconsultas.resource';
import type { OrderableService } from '../types';
import { buildInterconsultaInstructions, parseInterconsultaInstructions } from '../utils/interconsulta-details';
import styles from './request-interconsulta.scss';

export interface RequestInterconsultaWorkspaceProps {
  patientUuid?: string;
  order?: OrderBasketItem;
  orderTypeUuid?: string;
  submissionMode?: 'direct' | 'order-basket';
}

type RequestInterconsultaWorkspaceComponentProps = RequestInterconsultaWorkspaceProps &
  Partial<PatientWorkspace2DefinitionProps<RequestInterconsultaWorkspaceProps, object>>;

type Urgency = 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';
type DestinationMode = 'LOCAL' | 'EXTERNAL';

function asUrgency(value?: string): Urgency {
  return value === 'STAT' || value === 'ON_SCHEDULED_DATE' ? value : 'ROUTINE';
}

/**
 * Solicitud de interconsulta desde el chart del paciente / consulta externa.
 * Solo captura los datos propios de la interconsulta (servicio destino,
 * prioridad, motivo, fecha programada); paciente, visita, profesional y
 * location sale de la visita activa y el profesional de la sesión.
 */
const RequestInterconsultaWorkspaceForm: React.FC<RequestInterconsultaWorkspaceComponentProps> = (props) => {
  const { t } = useTranslation();
  const workspaceProps = props.workspaceProps ?? {};
  const patientUuid = props.patientUuid ?? props.groupProps?.patientUuid ?? workspaceProps.patientUuid;
  const initialOrder = props.order ?? workspaceProps.order;
  const submissionMode = props.submissionMode ?? workspaceProps.submissionMode ?? 'direct';
  const closeWorkspace = props.closeWorkspace ?? (() => Promise.resolve(true));
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const config = useConfig<ConfigObject>();
  const orderTypeUuid = props.orderTypeUuid ?? workspaceProps.orderTypeUuid ?? config.interconsultaOrderTypeUuid;
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const visit = currentVisit ?? activeVisit;
  const abortController = useAbortController();
  const invalidateInterconsultas = useInvalidateInterconsultas();
  const initialDetails = useMemo(
    () => parseInterconsultaInstructions(initialOrder?.instructions),
    [initialOrder?.instructions],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [destinationMode, setDestinationMode] = useState<DestinationMode>(
    initialDetails.externalDestination ? 'EXTERNAL' : 'LOCAL',
  );
  const [externalSpecialist, setExternalSpecialist] = useState(initialDetails.externalDestination ?? '');
  const [service, setService] = useState<OrderableService | null>(
    initialOrder?.concept && !initialDetails.externalDestination
      ? {
          uuid: initialOrder.concept.uuid,
          display: initialOrder.concept.display ?? initialOrder.display,
        }
      : null,
  );
  const [urgency, setUrgency] = useState<Urgency>(asUrgency(initialOrder?.urgencyCode ?? initialOrder?.urgency));
  const [scheduledDate, setScheduledDate] = useState<Date | null>(initialOrder?.scheduledDate ?? null);
  const [motivo, setMotivo] = useState(initialDetails.reason);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSessionProvider = Boolean(session?.currentProvider?.uuid);
  const { services, isLoading: isLoadingServices, error: destinationCatalogError } = useDestinationServices(searchTerm);
  const { orders, setOrders } = useOrderBasket<OrderBasketItem>(orderTypeUuid);

  const isBasketSubmission = submissionMode === 'order-basket';
  const isExternalDestination = destinationMode === 'EXTERNAL';
  const destinationIsComplete = isExternalDestination
    ? Boolean(config.externalSpecialistConceptUuid && externalSpecialist.trim())
    : Boolean(service);
  const isDirty = Boolean(service || externalSpecialist.trim() || motivo.trim());

  const providerUuid = session?.currentProvider?.uuid;
  const locationUuid = visit?.location?.uuid;
  const canSubmit =
    Boolean(patientUuid && providerUuid && locationUuid && destinationIsComplete && motivo.trim()) &&
    (urgency !== 'ON_SCHEDULED_DATE' || Boolean(scheduledDate)) &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !patientUuid || !providerUuid || !locationUuid) {
      return;
    }

    const destinationConceptUuid = isExternalDestination ? config.externalSpecialistConceptUuid : service?.uuid;
    const destinationDisplay = isExternalDestination
      ? externalSpecialist.trim()
      : (service?.display ?? t('destinationService', 'Servicio destino'));
    if (!destinationConceptUuid) {
      return;
    }

    const instructions = buildInterconsultaInstructions(motivo, isExternalDestination ? externalSpecialist : undefined);
    setIsSubmitting(true);
    try {
      if (isBasketSubmission) {
        const basketOrder: OrderBasketItem = {
          ...initialOrder,
          action: initialOrder?.action ?? 'NEW',
          concept: {
            uuid: destinationConceptUuid,
            display: destinationDisplay,
          },
          display: destinationDisplay,
          instructions,
          isOrderIncomplete: false,
          orderer: providerUuid,
          orderType: orderTypeUuid,
          scheduledDate: urgency === 'ON_SCHEDULED_DATE' ? (scheduledDate ?? undefined) : undefined,
          urgency,
          urgencyCode: urgency,
        };
        const updatedOrders = [...orders];
        const existingIndex = initialOrder
          ? orders.findIndex(
              (order) =>
                order === initialOrder ||
                (Boolean(initialOrder.uuid) && order.uuid === initialOrder.uuid) ||
                (order.action === initialOrder.action &&
                  order.concept?.uuid === initialOrder.concept?.uuid &&
                  order.instructions === initialOrder.instructions),
            )
          : isExternalDestination
            ? -1
            : orders.findIndex((order) => order.concept?.uuid === destinationConceptUuid);

        if (existingIndex >= 0) {
          updatedOrders[existingIndex] = basketOrder;
        } else {
          updatedOrders.push(basketOrder);
        }
        setOrders(updatedOrders);
        await closeWorkspace({ discardUnsavedChanges: true });
        return;
      }

      await createInterconsulta(
        {
          patientUuid,
          visitUuid: visit?.uuid,
          locationUuid,
          providerUuid,
          serviceConceptUuid: destinationConceptUuid,
          urgency,
          scheduledDate: scheduledDate ?? undefined,
          motivo: instructions,
          config,
        },
        abortController,
      );
      invalidateInterconsultas();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('interconsultaCreated', 'Interconsulta solicitada'),
        subtitle: destinationDisplay,
      });
      void closeWorkspace({ discardUnsavedChanges: true });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorCreatingInterconsulta', 'Error al solicitar la interconsulta'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('errorCreatingInterconsultaMessage', 'No se pudo solicitar la interconsulta. Intente nuevamente.'),
          { logContext: 'Create interconsultation request' },
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Workspace2 title={t('requestInterconsulta', 'Solicitar interconsulta')} hasUnsavedChanges={isDirty}>
      <Form className={styles.form} onSubmit={handleSubmit}>
        <Stack gap={5} className={styles.formContent}>
          {!visit && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('noActiveVisit', 'Sin visita activa')}
              subtitle={t(
                'noActiveVisitSubtitle',
                'Debe iniciar una visita en una ubicación asistencial antes de solicitar la interconsulta.',
              )}
            />
          )}
          {!hasSessionProvider && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('providerRequired', 'Profesional clínico requerido')}
              subtitle={t(
                'providerRequiredSubtitle',
                'Su usuario debe estar vinculado a un profesional para solicitar una interconsulta.',
              )}
            />
          )}
          <RadioButtonGroup
            legendText={t('destinationType', 'Tipo de destino')}
            name="interconsulta-destination-type"
            orientation="vertical"
            valueSelected={destinationMode}
            onChange={(value: DestinationMode) => setDestinationMode(value)}
          >
            <RadioButton
              id="destination-local"
              labelText={t('localConsultingRoom', 'Consultorio o servicio de Santa Clotilde')}
              value="LOCAL"
            />
            <RadioButton
              id="destination-external"
              labelText={t('externalSpecialist', 'Especialista externo o remoto')}
              value="EXTERNAL"
            />
          </RadioButtonGroup>
          {isExternalDestination ? (
            <>
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                title={t('externalInterconsultation', 'Interconsulta externa o remota')}
                subtitle={t(
                  'externalInterconsultationHelper',
                  'Registra una consulta clínica entre profesionales. No genera referencia, contrarreferencia ni traslado.',
                )}
              />
              <TextInput
                id="interconsulta-external-specialist"
                labelText={t('externalSpecialistName', 'Especialidad o profesional destino')}
                helperText={t('externalSpecialistNameHelper', 'Ejemplo: Cardiología remota')}
                maxLength={80}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExternalSpecialist(event.target.value)}
                value={externalSpecialist}
              />
            </>
          ) : (
            <>
              {destinationCatalogError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('destinationCatalogError', 'No se pudo cargar el catálogo de consultorios')}
                  subtitle={t('destinationCatalogErrorHelper', 'Actualice la pantalla o inténtelo nuevamente.')}
                />
              )}
              <ComboBox
                id="interconsulta-service"
                items={services}
                itemToString={(item: OrderableService | null) => item?.display ?? ''}
                onChange={({ selectedItem }: { selectedItem: OrderableService | null }) => setService(selectedItem)}
                onInputChange={(input: string) => setSearchTerm(input ?? '')}
                placeholder={t('searchService', 'Buscar consultorio o servicio...')}
                selectedItem={service}
                titleText={t('destinationService', 'Consultorio o servicio destino')}
                helperText={
                  isLoadingServices
                    ? t('loading', 'Cargando...')
                    : t('destinationServiceHelper', 'Seleccione un consultorio o servicio')
                }
              />
            </>
          )}
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
            maxCount={350}
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
            {isBasketSubmission
              ? t('addInterconsultaToBasket', 'Agregar a la canasta')
              : t('requestInterconsulta', 'Solicitar interconsulta')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

const RequestInterconsultaWorkspace: React.FC<RequestInterconsultaWorkspaceComponentProps> = (props) => (
  <RequirePrivilege privilege={interconsultasChartEditPrivilege}>
    <RequestInterconsultaWorkspaceForm {...props} />
  </RequirePrivilege>
);

export default RequestInterconsultaWorkspace;
