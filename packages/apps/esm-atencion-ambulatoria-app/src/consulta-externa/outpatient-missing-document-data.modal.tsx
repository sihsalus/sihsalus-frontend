import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import type { TFunction } from 'i18next';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConsultaExternaTabId } from './consulta-externa-tabs';
import type {
  OutpatientDocumentRequirement,
  OutpatientDocumentRequirementId,
} from './outpatient-document-requirements';
import styles from './outpatient-missing-document-data.scss';

export interface OutpatientMissingDocumentDataModalProps {
  closeModal: () => void;
  /** What could not be produced, e.g. "No se pueden imprimir las indicaciones". */
  title: string;
  /** Why, when the reason is not simply the list of pending data. */
  description?: string;
  requirements: OutpatientDocumentRequirement[];
  /** Absent when the dashboard cannot switch tabs, e.g. in a standalone render. */
  onNavigateToTab?: (tabId: ConsultaExternaTabId) => void;
}

function getRequirementLabel(t: TFunction, id: OutpatientDocumentRequirementId): string {
  switch (id) {
    case 'clinicalContent':
      return t(
        'outpatientRequirementClinicalContent',
        'Información clínica de la atención: anamnesis, examen físico, diagnóstico o tratamiento',
      );
    case 'clinicalEncounter':
      return t('outpatientRequirementClinicalEncounter', 'Encuentro clínico registrado en esta atención');
    case 'ambiguousClinicalEncounter':
      return t(
        'outpatientRequirementAmbiguousClinicalEncounter',
        'Un único encuentro clínico en la visita: hay más de uno registrado',
      );
    case 'primaryDiagnosis':
      return t('outpatientRequirementPrimaryDiagnosis', 'Un único diagnóstico principal');
    case 'primaryDiagnosisCie10':
      return t('outpatientRequirementPrimaryDiagnosisCie10', 'Código CIE-10 en el diagnóstico principal');
    case 'responsibleProfessional':
      return t('outpatientRequirementResponsibleProfessional', 'Profesional responsable del encuentro clínico');
    case 'followUpDate':
      return t('outpatientRequirementFollowUpDate', 'Fecha de control');
    case 'therapeuticIndications':
      return t('outpatientRequirementTherapeuticIndications', 'Indicaciones terapéuticas');
    case 'medications':
      return t('outpatientRequirementMedications', 'Medicamentos indicados');
    case 'medicationsByResponsibleProfessional':
      return t(
        'outpatientRequirementMedicationsByResponsibleProfessional',
        'Al menos un medicamento prescrito por el profesional responsable',
      );
  }
}

/** Reuses the dashboard tab labels so the modal names the tab the clinician sees. */
function getTabLabel(t: TFunction, tabId: ConsultaExternaTabId): string {
  switch (tabId) {
    case 'triage':
      return t('triageAndChiefComplaint', 'Triajes previos');
    case 'anamnesis':
      return t('anamnesis', 'Anamnesis');
    case 'soap':
      return t('soapNotes', 'Examen físico / SOAP');
    case 'complementaryTests':
      return t('complementaryTests', 'Pruebas complementarias');
    case 'diagnosis':
      return t('diagnosisClassification', 'Diagnóstico');
    case 'treatment':
      return t('treatmentPlan', 'Plan de Tratamiento');
    case 'referral':
      return t('referralCounterReferral', 'Referencia / Contrarreferencia');
  }
}

const OutpatientMissingDocumentDataModal: React.FC<OutpatientMissingDocumentDataModalProps> = ({
  closeModal,
  title,
  description,
  requirements,
  onNavigateToTab,
}) => {
  const { t } = useTranslation();
  const targetTab = requirements.find((requirement) => requirement.tab)?.tab;

  const handleNavigate = useCallback(() => {
    if (targetTab) onNavigateToTab?.(targetTab);
    closeModal();
  }, [closeModal, onNavigateToTab, targetTab]);

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={title} />
      <ModalBody>
        {description ? <p className={styles.description}>{description}</p> : null}
        {requirements.length ? (
          <>
            <p className={styles.description}>
              {t('outpatientMissingDocumentDataIntro', 'Faltan estos datos en la atención:')}
            </p>
            <ul className={styles.requirements}>
              {requirements.map((requirement) => (
                <li className={styles.requirement} key={requirement.id}>
                  <span>{getRequirementLabel(t, requirement.id)}</span>
                  {requirement.tab ? (
                    <span className={styles.requirementLocation}>{`→ ${getTabLabel(t, requirement.tab)}`}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className={styles.hint}>
              {t('outpatientMissingDocumentDataHint', 'Regístrelos y vuelva a intentar la impresión.')}
            </p>
          </>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('close', 'Cerrar')}
        </Button>
        {targetTab && onNavigateToTab ? (
          <Button kind="primary" onClick={handleNavigate}>
            {t('outpatientGoToTab', 'Ir a {{tab}}', { tab: getTabLabel(t, targetTab) })}
          </Button>
        ) : null}
      </ModalFooter>
    </div>
  );
};

export default OutpatientMissingDocumentDataModal;
