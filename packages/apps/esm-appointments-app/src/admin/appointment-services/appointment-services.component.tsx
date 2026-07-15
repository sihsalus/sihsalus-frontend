import {
  Button,
  ButtonSet,
  Dropdown,
  InlineNotification,
  Layer,
  SelectItem,
  TextInput,
  TimePicker,
  TimePickerSelect,
} from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useLocations, useSession } from '@openmrs/esm-framework';
import { Form, Formik, type FormikHelpers } from 'formik';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appointmentLocationTagName } from '../../constants';
import { closeOverlay } from '../../hooks/useOverlay';
import type { AppointmentService } from '../../types';
import styles from './appointment-services.scss';
import {
  appointmentServiceCreationCheckpointsMatch,
  clearAppointmentServiceCreationCheckpoint,
  loadAppointmentServiceCreationCheckpoint,
  saveAppointmentServiceCreationCheckpoint,
  type AppointmentServiceCreationScope,
} from './appointment-service-creation-checkpoint';
import {
  type AppointmentServiceCreatePayload,
  fetchAppointmentServices,
  hasSameAppointmentServiceName,
  isSameAppointmentService,
  toTwentyFourHourServiceTime,
  useAppointmentServices,
} from './appointment-services-hook';
import { validationSchema } from './appointment-services-validation';

const isTerminalCreateStatus = (status?: number) => status === 200 || status === 201 || status === 204;

const doesCreateResponseConfirmService = (
  response: { status?: number; data?: unknown },
  payload: AppointmentServiceCreatePayload,
) => {
  if (response.status === 204) {
    return true;
  }
  if (!isTerminalCreateStatus(response.status) || !response.data || typeof response.data !== 'object') {
    return false;
  }
  const service = response.data as AppointmentService;
  return typeof service.uuid === 'string' && Boolean(service.uuid.trim()) && isSameAppointmentService(service, payload);
};
let activeAppointmentServiceCreation: symbol | null = null;

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}

const isDefinitiveCreateRejection = (error: unknown) => {
  const status = getErrorStatus(error);
  return Boolean(status && status >= 400 && status < 500 && ![408, 425, 429, 499].includes(status));
};

const AppointmentServices: React.FC = () => {
  const { t } = useTranslation();
  const { appointmentServiceInitialValue, addNewAppointmentService } = useAppointmentServices();
  const [isCreateOutcomeAmbiguous, setIsCreateOutcomeAmbiguous] = useState(false);
  const [isCreateConfirmed, setIsCreateConfirmed] = useState(false);
  const [isCheckpointCleanupFailed, setIsCheckpointCleanupFailed] = useState(false);
  const [didCloseAfterCreateFail, setDidCloseAfterCreateFail] = useState(false);
  const createInFlightRef = useRef(false);

  const locations = useLocations(appointmentLocationTagName);
  const session = useSession();
  const handleSubmit = async (values: AppointmentService, helpers: FormikHelpers<AppointmentService>) => {
    if (createInFlightRef.current || isCreateOutcomeAmbiguous) {
      return;
    }
    if (activeAppointmentServiceCreation) {
      helpers.setSubmitting(false);
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'warning',
        subtitle: t(
          'appointmentServiceCreateAlreadyInProgress',
          'Ya hay una creación de servicio en curso en esta pantalla. Espere su resultado antes de volver a guardar.',
        ),
      });
      return;
    }
    const operationToken = Symbol('appointment-service-create');
    activeAppointmentServiceCreation = operationToken;
    createInFlightRef.current = true;
    const releaseSharedLock = () => {
      if (activeAppointmentServiceCreation === operationToken) {
        activeAppointmentServiceCreation = null;
      }
    };
    const release = () => {
      releaseSharedLock();
      createInFlightRef.current = false;
      helpers.setSubmitting(false);
    };
    const completeConfirmedCreation = () => {
      releaseSharedLock();
      setIsCreateConfirmed(true);
      helpers.setSubmitting(false);
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('appointmentServiceCreate', 'Appointment service created successfully'),
        title: t('appointmentService', 'Appointment service'),
      });
      try {
        closeOverlay();
      } catch {
        setDidCloseAfterCreateFail(true);
        showSnackbar({
          title: t('appointmentService', 'Appointment service'),
          kind: 'warning',
          subtitle: t(
            'appointmentServiceCreatedCloseFailed',
            'El servicio ya fue creado, pero la ventana no pudo cerrarse. No vuelva a guardarlo.',
          ),
        });
      }
    };
    const keepConfirmedCreationLocked = () => {
      releaseSharedLock();
      setIsCreateConfirmed(true);
      setIsCheckpointCleanupFailed(true);
      helpers.setSubmitting(false);
      showSnackbar({
        title: t('appointmentService', 'Appointment service'),
        kind: 'warning',
        subtitle: t(
          'appointmentServiceCreatedCheckpointClearFailed',
          'El servicio ya fue creado, pero no se pudo cerrar su control de seguridad. No vuelva a guardarlo; actualice la pantalla.',
        ),
      });
    };
    const keepUnknownCreationLocked = () => {
      releaseSharedLock();
      helpers.setSubmitting(false);
      setIsCreateOutcomeAmbiguous(true);
    };
    let payload: AppointmentServiceCreatePayload;
    try {
      const selectedLocationUuid = values.location?.uuid;
      if (!selectedLocationUuid || !locations.some((location) => location.uuid === selectedLocationUuid)) {
        throw new Error('The selected appointment location is not available.');
      }
      payload = {
        name: values.name.trim(),
        startTime: toTwentyFourHourServiceTime(values.startTime, values.startTimeTimeFormat ?? ''),
        endTime: toTwentyFourHourServiceTime(values.endTime, values.endTimeTimeFormat ?? ''),
        durationMins: Number(values.durationMins),
        color: values.color ?? '',
        locationUuid: selectedLocationUuid,
      };
    } catch {
      release();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'error',
        subtitle: t('appointmentServicePayloadInvalid', 'Revise el nombre, horario, duración y sede del servicio.'),
      });
      return;
    }

    const scope: AppointmentServiceCreationScope | null =
      session?.sessionId?.trim() && session.user?.uuid?.trim()
        ? { sessionId: session.sessionId.trim(), userUuid: session.user.uuid.trim() }
        : null;
    if (!scope) {
      release();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'error',
        subtitle: t(
          'appointmentServiceSessionUnavailable',
          'No se pudo verificar la sesión actual. Vuelva a iniciar sesión antes de guardar.',
        ),
      });
      return;
    }

    let pendingCheckpoint: ReturnType<typeof loadAppointmentServiceCreationCheckpoint>;
    try {
      pendingCheckpoint = loadAppointmentServiceCreationCheckpoint();
    } catch {
      keepUnknownCreationLocked();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'warning',
        subtitle: t(
          'appointmentServiceCheckpointInvalid',
          'Existe una creación pendiente que no puede verificarse. No vuelva a guardar; solicite revisión del catálogo.',
        ),
      });
      return;
    }

    if (pendingCheckpoint) {
      if (!appointmentServiceCreationCheckpointsMatch(pendingCheckpoint, payload, scope)) {
        keepUnknownCreationLocked();
        showSnackbar({
          title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
          kind: 'warning',
          subtitle: t(
            'appointmentServiceCheckpointConflict',
            'Hay otra creación de servicio pendiente en esta sesión. No guarde hasta verificar el catálogo.',
          ),
        });
        return;
      }

      try {
        const baselineUuids = new Set(pendingCheckpoint.baselineUuids);
        const newServices = (await fetchAppointmentServices()).filter(
          (service) => !baselineUuids.has(service.uuid),
        );
        const servicesWithSameName = newServices.filter((service) =>
          hasSameAppointmentServiceName(service, payload.name),
        );
        const matches = servicesWithSameName.filter((service) => isSameAppointmentService(service, payload));
        if (servicesWithSameName.length === 1 && matches.length === 1) {
          if (!clearAppointmentServiceCreationCheckpoint(pendingCheckpoint.attemptId)) {
            keepConfirmedCreationLocked();
            return;
          }
          completeConfirmedCreation();
          return;
        }
      } catch {
        // A pending POST can only be retried after a conclusive catalog read.
      }

      keepUnknownCreationLocked();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'warning',
        subtitle: t(
          'appointmentServiceCreateOutcomeUnknown',
          'No se pudo confirmar si el servicio fue creado. No vuelva a enviarlo; actualice primero el catálogo.',
        ),
      });
      return;
    }

    let baselineServices: Array<AppointmentService>;
    try {
      baselineServices = await fetchAppointmentServices();
    } catch (error) {
      release();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'error',
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'appointmentServiceCatalogVerificationFailed',
            'No se pudo verificar el catálogo de servicios. Actualice la pantalla antes de guardar.',
          ),
          { logContext: 'Verify appointment service catalog' },
        ),
      });
      return;
    }

    if (baselineServices.some((service) => hasSameAppointmentServiceName(service, payload.name))) {
      release();
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: 'error',
        subtitle: t(
          'appointmentServiceAlreadyExists',
          'Ya existe un servicio de citas con el mismo nombre.',
        ),
      });
      return;
    }

    const attemptId = globalThis.crypto?.randomUUID?.();
    if (
      !attemptId ||
      !saveAppointmentServiceCreationCheckpoint({
        version: 1,
        attemptId,
        state: 'create-pending',
        createdAt: Date.now(),
        payload,
        baselineUuids: baselineServices.map((service) => service.uuid),
        scope,
      })
    ) {
      let collidingCheckpoint = false;
      try {
        collidingCheckpoint = Boolean(loadAppointmentServiceCreationCheckpoint());
      } catch {
        collidingCheckpoint = true;
      }
      if (collidingCheckpoint) {
        keepUnknownCreationLocked();
        showSnackbar({
          title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
          kind: 'warning',
          subtitle: t(
            'appointmentServiceCheckpointConflict',
            'Hay otra creación de servicio pendiente en esta sesión. No guarde hasta verificar el catálogo.',
          ),
        });
      } else {
        release();
        showSnackbar({
          title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
          kind: 'error',
          subtitle: t(
            'appointmentServiceCheckpointUnavailable',
            'No se pudo preparar un guardado seguro en este navegador. Habilite el almacenamiento de sesión antes de guardar.',
          ),
        });
      }
      return;
    }

    try {
      const response = await addNewAppointmentService(payload);
      if (!doesCreateResponseConfirmService(response, payload)) {
        throw Object.assign(new Error('Appointment service create returned an unsuccessful status.'), {
          status: response.status,
        });
      }

      if (!clearAppointmentServiceCreationCheckpoint(attemptId)) {
        keepConfirmedCreationLocked();
        return;
      }
      completeConfirmedCreation();
      return;
    } catch (error) {
      let reconciliationWasValid = false;
      try {
        const baselineUuids = new Set(baselineServices.map((service) => service.uuid));
        const newServices = (await fetchAppointmentServices()).filter((service) => !baselineUuids.has(service.uuid));
        const servicesWithSameName = newServices.filter((service) =>
          hasSameAppointmentServiceName(service, payload.name),
        );
        const matches = servicesWithSameName.filter((service) => isSameAppointmentService(service, payload));
        reconciliationWasValid = true;
        if (servicesWithSameName.length === 1 && matches.length === 1) {
          if (!clearAppointmentServiceCreationCheckpoint(attemptId)) {
            keepConfirmedCreationLocked();
            return;
          }
          completeConfirmedCreation();
          return;
        }
        if (servicesWithSameName.length > 0) {
          reconciliationWasValid = false;
        }
      } catch {
        reconciliationWasValid = false;
      }

      const definitiveRejection = isDefinitiveCreateRejection(error) && reconciliationWasValid;
      const checkpointWasCleared = definitiveRejection && clearAppointmentServiceCreationCheckpoint(attemptId);
      if (checkpointWasCleared) {
        release();
      } else {
        keepUnknownCreationLocked();
      }
      showSnackbar({
        title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
        kind: checkpointWasCleared ? 'error' : 'warning',
        subtitle: checkpointWasCleared
          ? getUserFacingErrorMessage(
              error,
              t('appointmentServiceCreateRejected', 'El servicio no fue creado. Revise los datos antes de reintentar.'),
              { logContext: 'Create appointment service rejected' },
            )
          : definitiveRejection
            ? t(
                'appointmentServiceRejectedCheckpointClearFailed',
                'El servicio no fue creado, pero no se pudo cerrar su control de seguridad. No reintente hasta actualizar la pantalla.',
              )
          : t(
              'appointmentServiceCreateOutcomeUnknown',
              'No se pudo confirmar si el servicio fue creado. No vuelva a enviarlo; actualice primero el catálogo.',
            ),
      });
    }
  };
  return (
    <Formik
      onSubmit={handleSubmit}
      validateOnMount
      validationSchema={validationSchema}
      initialValues={appointmentServiceInitialValue}
    >
      {(props) => {
        return (
          <Form onSubmit={props.handleSubmit} className={styles.appointmentServiceContainer}>
            <p className={styles.formTitle}>{t('createAppointmentService', 'Create appointment service')}</p>
            {isCreateOutcomeAmbiguous && (
              <InlineNotification
                kind="warning"
                lowContrast={false}
                title={t('appointmentServiceCreatePendingVerification', 'Resultado pendiente de verificación')}
                subtitle={t(
                  'appointmentServiceCreateOutcomeUnknown',
                  'No se pudo confirmar si el servicio fue creado. No vuelva a enviarlo; actualice primero el catálogo.',
                )}
              />
            )}
            {didCloseAfterCreateFail && (
              <InlineNotification
                kind="warning"
                lowContrast={false}
                title={t('appointmentServiceCreated', 'Servicio creado')}
                subtitle={t(
                  'appointmentServiceCreatedCloseFailed',
                  'El servicio ya fue creado, pero la ventana no pudo cerrarse. No vuelva a guardarlo.',
                )}
              />
            )}
            {isCheckpointCleanupFailed && (
              <InlineNotification
                kind="warning"
                lowContrast={false}
                title={t('appointmentServiceCreated', 'Servicio creado')}
                subtitle={t(
                  'appointmentServiceCreatedCheckpointClearFailed',
                  'El servicio ya fue creado, pero no se pudo cerrar su control de seguridad. No vuelva a guardarlo; actualice la pantalla.',
                )}
              />
            )}
            <Layer>
              <TextInput
                id="name"
                invalidText={t(props.errors.name)}
                labelText={t('appointmentServiceName', 'Appointment service name')}
                placeholder={t('appointmentServiceName', 'Appointment service name')}
                invalid={!!(props.touched && props.errors.name)}
                onChange={props.handleChange}
                value={props.values.name}
                name="name"
                maxLength={50}
                onBlur={props.handleBlur}
              />
            </Layer>
            <Layer>
              <TimePicker
                className={styles.timePickerInput}
                invalid={!!(props.touched && props.errors.startTime)}
                pattern="([\d]+:[\d]{2})"
                value={props.values.startTime}
                onBlur={() => props.setFieldTouched('startTime', true)}
                onChange={(event) => props.setFieldValue('startTime', event.target.value)}
                labelText={t('startTime', 'Start Time')}
                id="start-time-picker"
              >
                <TimePickerSelect
                  name="startTimeTimeFormat"
                  onChange={props.handleChange}
                  value={props.values.startTimeTimeFormat}
                  id="start-time-format"
                  aria-label={t('time', 'Time')}
                >
                  <SelectItem value="AM" text="AM" />
                  <SelectItem value="PM" text="PM" />
                </TimePickerSelect>
              </TimePicker>
            </Layer>

            <Layer>
              <TimePicker
                invalid={!!(props.touched && props.errors.endTime)}
                className={styles.timePickerInput}
                pattern="([\d]+:[\d]{2})"
                value={props.values.endTime}
                onBlur={() => props.setFieldTouched('endTime', true)}
                onChange={(event) => props.setFieldValue('endTime', event.target.value)}
                labelText={t('endTime', 'End Time')}
                id="end-time-picker"
              >
                <TimePickerSelect
                  name="endTimeTimeFormat"
                  onChange={props.handleChange}
                  id="end-time-format"
                  value={props.values.endTimeTimeFormat}
                  aria-label={t('time', 'Time')}
                >
                  <SelectItem value="AM" text="AM" />
                  <SelectItem value="PM" text="PM" />
                </TimePickerSelect>
              </TimePicker>
            </Layer>

            <Layer>
              <TextInput
                id="durationMins"
                invalidText={props.errors.durationMins}
                labelText={t('durationMins', 'Duration min')}
                placeholder={t('durationMins', 'Duration min')}
                invalid={!!(props.touched && props.errors.durationMins)}
                onChange={props.handleChange}
                value={props.values.durationMins}
                name="durationMins"
                type="number"
                min={1}
                max={1440}
                step={1}
              />
            </Layer>

            <Layer>
              <Dropdown
                id="default"
                titleText={t('selectLocation', 'Select location')}
                label={t('selectLocation', 'Select location')}
                items={locations}
                itemToString={(item) => (item ? item.display : '')}
                selectedItem={props.values.location}
                invalid={!!(props.touched && props.errors.location?.uuid)}
                onChange={({ selectedItem }) => props.setValues({ ...props.values, location: selectedItem })}
              />
            </Layer>

            <Layer>
              <TextInput
                id="color"
                invalid={!!(props.touched && props.errors.color)}
                onChange={props.handleChange}
                invalidText={props.errors.color}
                labelText={t('appointmentColor', 'Appointment color')}
                type="color"
                name="color"
              />
            </Layer>

            <ButtonSet className={styles.buttonSet}>
              <Button
                disabled={props.isSubmitting || isCreateOutcomeAmbiguous || isCheckpointCleanupFailed}
                onClick={closeOverlay}
                style={{ maxWidth: 'none', width: '50%' }}
                className={styles.button}
                kind="secondary"
              >
                {t('discard', 'Discard')}
              </Button>
              <Button
                disabled={!props.isValid || props.isSubmitting || isCreateOutcomeAmbiguous || isCreateConfirmed}
                style={{ maxWidth: 'none', width: '50%' }}
                className={styles.button}
                kind="primary"
                type="submit"
              >
                {t('save', 'Save')}
              </Button>
            </ButtonSet>
          </Form>
        );
      }}
    </Formik>
  );
};

export default AppointmentServices;
