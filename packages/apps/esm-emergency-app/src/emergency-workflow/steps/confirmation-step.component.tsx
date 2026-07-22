/**
 * Confirmation Step Component
 *
 * Final step in the emergency quick registration workflow.
 * Shows a summary of the registered patient, assigned priority,
 * visit, and queue entry status.
 */

import {
  Button,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
  Tile,
} from '@carbon/react';
import { CheckmarkFilled, Close, Renew, User } from '@carbon/react/icons';
import { age } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WorkflowState } from '../types';
import styles from './confirmation-step.component.scss';

interface ConfirmationStepProps {
  workflowState: WorkflowState;
  onRegisterAnother: () => void;
  onClose: () => void;
}

const ConfirmationStep: React.FC<ConfirmationStepProps> = ({ workflowState, onRegisterAnother, onClose }) => {
  const { t } = useTranslation();

  const patientName =
    workflowState.patientData?.person?.personName?.display ||
    workflowState.patientData?.person?.display ||
    workflowState.patientData?.display ||
    t('unknown', 'Desconocido');

  const patientAge = workflowState.patientData?.person?.birthdate
    ? age(workflowState.patientData.person.birthdate)
    : null;
  const patientGender = workflowState.patientData?.person?.gender;
  const patientIdentifier = workflowState.patientData?.identifiers?.[0];
  const isDirectEmergency = workflowState.initialClassification === 'emergency';

  const genderLabel =
    patientGender === 'M'
      ? t('male', 'Masculino')
      : patientGender === 'F'
        ? t('female', 'Femenino')
        : t('notSpecified', 'No especificado');

  return (
    <div className={styles.container}>
      <Stack gap={6}>
        {/* Progress Indicator */}
        <ProgressIndicator currentIndex={2} spaceEqually>
          <ProgressStep
            label={t('patient', 'Paciente')}
            secondaryLabel={t('searchOrRegister', 'Buscar / Registrar')}
            complete
          />
          <ProgressStep
            label={t('classification', 'Clasificación')}
            secondaryLabel={t('initialClassification', 'Clasificación inicial')}
            complete
          />
          <ProgressStep
            label={t('confirmed', 'Confirmado')}
            secondaryLabel={
              isDirectEmergency ? t('attentionQueue', 'Cola de Atención') : t('inTriageQueue', 'En cola de triaje')
            }
            current
          />
        </ProgressIndicator>

        {/* Success Notification */}
        <InlineNotification
          kind="success"
          lowContrast
          hideCloseButton
          title={
            isDirectEmergency
              ? t('emergencyDirectAttention', 'Paciente enviado a atención inmediata')
              : t('patientAddedToQueue', 'Paciente agregado a la cola de triaje')
          }
          subtitle={
            isDirectEmergency
              ? t('emergencyDirectAttentionSubtitle', 'Prioridad I — El triaje se puede completar durante la atención.')
              : t(
                  'patientAddedToQueueSubtitle',
                  'El paciente ha sido registrado y enviado a la cola de triaje con estado "Pendiente de Triaje".',
                )
          }
        />

        {/* Patient Summary Card */}
        <Tile className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <div className={styles.patientHeader}>
              <CheckmarkFilled size={24} className={styles.successIcon} />
              <h4 className={styles.cardTitle}>{t('registrationSummary', 'Resumen del registro')}</h4>
            </div>
          </div>

          <div className={styles.cardContent}>
            {/* Patient Info */}
            <div className={styles.patientSection}>
              <div className={styles.patientAvatar}>
                <User size={40} />
              </div>
              <div className={styles.patientInfo}>
                <h5 className={styles.patientName}>{patientName}</h5>
                <div className={styles.patientMeta}>
                  {patientAge != null && (
                    <span>
                      {patientAge}
                    </span>
                  )}
                  {patientAge != null && <span className={styles.separator}>|</span>}
                  <span>{genderLabel}</span>
                  {patientIdentifier && (
                    <>
                      <span className={styles.separator}>|</span>
                      <span>
                        {patientIdentifier.identifierType?.display || 'ID'}: {patientIdentifier.identifier}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Details List */}
            <StructuredListWrapper className={styles.detailsList}>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>{t('field', 'Campo')}</StructuredListCell>
                  <StructuredListCell head>{t('value', 'Valor')}</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>{t('initialClassificationLabel', 'Clasificación inicial')}</StructuredListCell>
                  <StructuredListCell>
                    {workflowState.initialClassification === 'emergency' ? (
                      <Tag type="red" size="md">
                        {t('emergency', 'Emergencia')}
                      </Tag>
                    ) : workflowState.initialClassification === 'urgency' ? (
                      <Tag type="green" size="md">
                        {t('urgency', 'Urgencia')}
                      </Tag>
                    ) : (
                      <Tag type="gray" size="md">
                        {t('notAssigned', 'No asignada')}
                      </Tag>
                    )}
                  </StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>{t('queueStatus', 'Estado en cola')}</StructuredListCell>
                  <StructuredListCell>
                    <Tag type={isDirectEmergency ? 'red' : 'blue'} size="md">
                      {isDirectEmergency
                        ? t('statusInService', 'Atendiéndose')
                        : t('pendingTriage', 'Pendiente de Triaje')}
                    </Tag>
                  </StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    {isDirectEmergency ? t('priority', 'Prioridad') : t('triagePriority', 'Prioridad de triaje')}
                  </StructuredListCell>
                  <StructuredListCell>
                    <Tag type={isDirectEmergency ? 'red' : 'outline'} size="md">
                      {isDirectEmergency
                        ? t('priorityI', 'Prioridad I')
                        : t('pendingTriageAssignment', 'Se asignará en triaje')}
                    </Tag>
                  </StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>{t('emergencyVisit', 'Visita de emergencia')}</StructuredListCell>
                  <StructuredListCell>
                    {workflowState.visitUuid ? (
                      <Tag type="green" size="md">
                        {t('visitCreated', 'Visita creada')}
                      </Tag>
                    ) : (
                      <Tag type="warm-gray" size="md">
                        {t('pendingVisit', 'Pendiente')}
                      </Tag>
                    )}
                  </StructuredListCell>
                </StructuredListRow>
                {workflowState.queueEntryUuid && (
                  <StructuredListRow>
                    <StructuredListCell>{t('queueEntry', 'Entrada en cola')}</StructuredListCell>
                    <StructuredListCell>
                      <Tag type="green" size="md">
                        {t('registered', 'Registrado')}
                      </Tag>
                    </StructuredListCell>
                  </StructuredListRow>
                )}
              </StructuredListBody>
            </StructuredListWrapper>
          </div>
        </Tile>

        {/* Actions */}
        <div className={styles.actions}>
          <Button kind="tertiary" renderIcon={Renew} onClick={onRegisterAnother}>
            {t('registerAnotherPatient', 'Registrar otro paciente')}
          </Button>
          <Button kind="primary" renderIcon={Close} onClick={onClose}>
            {t('closeAndReturn', 'Cerrar y volver a la cola')}
          </Button>
        </div>
      </Stack>
    </div>
  );
};

export default ConfirmationStep;
