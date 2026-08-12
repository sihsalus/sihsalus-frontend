import { InlineNotification } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { QueueVisitStartPreflightState } from './queue-visit-start-preflight';

interface QueueVisitStartPreflightNoticeProps {
  state: Exclude<QueueVisitStartPreflightState, 'not-required' | 'ready'>;
}

const QueueVisitStartPreflightNotice: React.FC<QueueVisitStartPreflightNoticeProps> = ({ state }) => {
  const { t } = useTranslation();
  const isLoading = state === 'patient-loading';
  const message = {
    'visit-capability-missing': {
      title: t('queueVisitCapabilityMissing', 'No puede iniciar una consulta desde esta cola'),
      subtitle: t(
        'queueVisitCapabilityMissingDescription',
        'El paciente no tiene una consulta activa y su usuario no cuenta con los permisos para crearla. Regrese a la búsqueda o solicite apoyo a un usuario autorizado.',
      ),
    },
    'patient-loading': {
      title: t('queuePatientAgeLoading', 'Verificando la edad del paciente'),
      subtitle: t(
        'queuePatientAgeLoadingDescription',
        'Espere mientras se valida si el paciente requiere un acompañante.',
      ),
    },
    'patient-age-unavailable': {
      title: t('queuePatientAgeUnavailable', 'No se pudo verificar la edad del paciente'),
      subtitle: t(
        'queuePatientAgeUnavailableDescription',
        'Vuelva a la búsqueda e intente nuevamente. Si el problema continúa, revise que el paciente tenga una fecha de nacimiento válida.',
      ),
    },
    'companion-capability-missing': {
      title: t('queueCompanionCapabilityMissing', 'Se requiere acceso a acompañantes'),
      subtitle: t(
        'queueCompanionCapabilityMissingDescription',
        'El paciente es menor de edad y su usuario no puede buscar ni registrar un acompañante. Solicite apoyo a un usuario con alguno de esos accesos.',
      ),
    },
  }[state];

  return (
    <InlineNotification
      hideCloseButton
      kind={isLoading ? 'info' : 'error'}
      lowContrast
      role={isLoading ? 'status' : 'alert'}
      title={message.title}
      subtitle={message.subtitle}
    />
  );
};

export default QueueVisitStartPreflightNotice;
