import { InlineNotification, Link } from '@carbon/react';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { MotherChildRelationships } from '@openmrs/esm-patient-common-lib';
import { useTranslation } from 'react-i18next';
import { credNeonatalPrivilege } from '../../constants';
import { calculateAgeInDays, calculateAgeInMonths } from '../../utils/age-group-utils';

/** NTS 238 6.6.4: 1 month, 12 months, then annually at ages 2–4; check the adult's history. */
export function isCaregiverScreeningAge(birthDate?: string, referenceDate?: string | Date): boolean {
  if (!birthDate) return false;
  const days = calculateAgeInDays(birthDate, referenceDate);
  const months = calculateAgeInMonths(birthDate, referenceDate);
  return (days >= 29 && days <= 59) || (months >= 12 && months < 60);
}

export default function CaregiverScreening({
  patientUuid,
  birthDate,
  referenceDate,
}: {
  patientUuid: string;
  birthDate?: string;
  referenceDate?: string | Date;
}) {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const session = useSession();
  if (!isCaregiverScreeningAge(birthDate, referenceDate)) return null;
  const canViewChart = Boolean(
    session?.authenticated && session.user?.uuid && userHasAccess('app:hoja.clinica', session.user),
  );
  return (
    <section aria-label={t('caregiverScreeningTitle', 'Salud mental de la madre, padre o cuidador')}>
      <InlineNotification
        kind="info"
        hideCloseButton
        lowContrast
        title={t('caregiverScreeningTitle', 'Salud mental de la madre, padre o cuidador')}
        subtitle={t(
          'caregiverScreeningHelp',
          'Verifique el tamizaje del adulto al mes y a los 12 meses del niño, y anualmente de los 2 a los 4 años, o antes si hay riesgo. Confirme quién es el cuidador evaluado y registre PHQ-9, AUDIT-C y la evaluación de violencia en su propia historia clínica. El vínculo de madre no identifica por sí solo al cuidador presente.',
        )}
      />
      {canViewChart && userHasAccess('app:opciones.busquedaPaciente', session.user) && (
        <Link href={`${window.getOpenmrsSpaBase()}search`}>
          {t('caregiverOpenSearch', 'Buscar la historia del adulto identificado')}
        </Link>
      )}
      <MotherChildRelationships
        patientUuid={patientUuid}
        patientRole="child"
        canView={canViewChart && userHasAccess(credNeonatalPrivilege, session?.user)}
        translationNamespace="@sihsalus/esm-cred-app"
      />
    </section>
  );
}
