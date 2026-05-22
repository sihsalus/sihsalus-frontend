import { InlineLoading } from '@carbon/react';
import { getPatientName } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import { useActiveVisitSummary } from '../resources/admissions.resource';
import styles from './clinical-identity-summary.scss';

interface ClinicalIdentitySummaryProps {
  patient?: fhir.Patient | null;
  patientUuid: string;
}

function getIdentifier(patient?: fhir.Patient | null) {
  const identifiers = patient?.identifier ?? [];
  const preferredIdentifier =
    identifiers.find((identifier) => /historia|clinical|openmrs|hc/i.test(identifier.type?.text ?? '')) ??
    identifiers.find((identifier) => /dni|ce|pasaporte|pass|documento/i.test(identifier.type?.text ?? '')) ??
    identifiers[0];

  return [preferredIdentifier?.type?.text, preferredIdentifier?.value].filter(Boolean).join(': ');
}

function getAge(birthDate?: string) {
  if (!birthDate) {
    return '';
  }

  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return `${age}`;
}

export default function ClinicalIdentitySummary({ patient, patientUuid }: ClinicalIdentitySummaryProps) {
  const { t } = useTranslation(moduleName);
  const { visit, isLoading } = useActiveVisitSummary(patientUuid);

  if (!patient) {
    return null;
  }

  return (
    <section
      className={styles.summary}
      aria-label={t('minimumPatientIdentification', 'Identificación mínima del paciente')}
    >
      <dl>
        <div>
          <dt>{t('patient', 'Paciente')}</dt>
          <dd>{getPatientName(patient)}</dd>
        </div>
        <div>
          <dt>{t('medicalRecordOrDocument', 'HC/documento')}</dt>
          <dd>{getIdentifier(patient) || '-'}</dd>
        </div>
        <div>
          <dt>{t('ageBirthSex', 'Edad/nacimiento/sexo')}</dt>
          <dd>{[getAge(patient.birthDate), patient.birthDate, patient.gender].filter(Boolean).join(' / ') || '-'}</dd>
        </div>
        <div>
          <dt>{t('serviceLocation', 'Servicio/ubicación')}</dt>
          <dd>
            {isLoading ? (
              <InlineLoading description={t('loadingVisit', 'Cargando visita')} />
            ) : (
              [visit?.service, visit?.location].filter(Boolean).join(' / ') || '-'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
