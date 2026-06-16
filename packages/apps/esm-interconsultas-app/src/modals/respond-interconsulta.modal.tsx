import { Button, ModalBody, ModalFooter, ModalHeader, Stack, TextArea } from '@carbon/react';
import { showSnackbar, useAbortController, useConfig } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { respondInterconsulta, useInvalidateInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder } from '../types';

interface RespondInterconsultaModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
}

const RespondInterconsultaModal: React.FC<RespondInterconsultaModalProps> = ({ closeModal, order }) => {
  const { t } = useTranslation();
  const { concepts } = useConfig<ConfigObject>();
  const [respuesta, setRespuesta] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const invalidateInterconsultas = useInvalidateInterconsultas();

  const handleRespond = async () => {
    setIsSubmitting(true);
    try {
      await respondInterconsulta(
        {
          order,
          respuesta: respuesta.trim(),
          recomendaciones: recomendaciones.trim(),
          respuestaConceptUuid: concepts.respuestaConceptUuid,
          recomendacionesConceptUuid: concepts.recomendacionesConceptUuid || undefined,
        },
        abortController,
      );
      invalidateInterconsultas();
      closeModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('interconsultaResponded', 'Interconsulta respondida'),
        subtitle: `${order.concept?.display ?? ''} — ${order.patient?.display ?? ''}`,
      });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorRespondingInterconsulta', 'Error al responder la interconsulta'),
        subtitle: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('respondInterconsultaTitle', 'Responder interconsulta')} />
      <ModalBody hasForm>
        <Stack gap={5}>
          <p>
            {t(
              'respondInterconsultaHelper',
              'Registre la respuesta y las recomendaciones. La respuesta quedará ligada a la orden y visible en la historia del paciente; la interconsulta pasará al estado "Respondida".',
            )}
          </p>
          <TextArea
            id="respond-respuesta"
            labelText={t('responseText', 'Respuesta / informe')}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setRespuesta(event.target.value)}
            rows={4}
            value={respuesta}
          />
          <TextArea
            id="respond-recomendaciones"
            labelText={t('recommendations', 'Recomendaciones (opcional)')}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setRecomendaciones(event.target.value)}
            rows={3}
            value={recomendaciones}
          />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button type="submit" onClick={handleRespond} disabled={isSubmitting || !respuesta.trim()}>
          {t('respondAndComplete', 'Responder y completar')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default RespondInterconsultaModal;
