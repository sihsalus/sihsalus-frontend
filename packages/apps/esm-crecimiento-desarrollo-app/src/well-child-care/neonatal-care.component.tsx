import {
  Activity,
  ChartLineData,
  CloudMonitoring,
  HospitalBed,
  Stethoscope,
  UserFollow,
  WatsonHealthCobbAngle,
} from '@carbon/react/icons';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  ErrorState,
  evaluateShowWhenExpression,
  TabbedDashboard,
  type TabConfig,
  usePatientEnrollment,
} from '@openmrs/esm-patient-common-lib';
import { UnauthorizedState } from '@sihsalus/esm-rbac';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { neonatalCarePrivilege, neonatalFluidBalanceSlot } from '../constants';
import { wellChildCareNavGroup } from '../dashboard.meta';

export interface NeonatalCareProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

function NeonatalCareTabs({ patient, patientUuid }: { patient: fhir.Patient; patientUuid: string }) {
  const translationNamespace = '@sihsalus/esm-cred-app';
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'vitals',
        labelKey: 'newbornVitals',
        icon: Activity,
        slotName: 'neonatal-vitals-slot',
      },
      {
        id: 'fluid-balance',
        labelKey: 'fluidBalance',
        icon: ChartLineData,
        slotName: neonatalFluidBalanceSlot,
      },
      {
        labelKey: 'perinatalRecord',
        icon: UserFollow,
        slotName: 'neonatal-perinatal-slot',
      },
      {
        labelKey: 'immediateAttention',
        icon: CloudMonitoring,
        slotName: 'neonatal-attention-slot',
      },
      {
        labelKey: 'cephalocaudalEvaluation',
        icon: Stethoscope,
        slotName: 'neonatal-evaluation-slot',
      },
      {
        labelKey: 'alojamientoConjunto',
        icon: HospitalBed,
        slotName: 'neonatal-alojamiento-conjunto-slot',
      },
      {
        labelKey: 'breastfeedingTab',
        icon: WatsonHealthCobbAngle,
        slotName: 'neonatal-counseling-slot',
      },
    ],
    [],
  );

  return (
    <TabbedDashboard
      patient={patient}
      patientUuid={patientUuid}
      titleKey="neonatalCare"
      tabs={tabs}
      ariaLabelKey="neonatalCareTabs"
      translationNamespace={translationNamespace}
      mountActiveTabOnly
    />
  );
}

function EnrolledNeonatalCare({ patient, patientUuid }: { patient: fhir.Patient; patientUuid: string }) {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const { activePatientEnrollment, isLoading, error } = usePatientEnrollment(patientUuid);

  if (isLoading) return <InlineLoading description={t('credLoadingProgram')} />;
  if (error) return <ErrorState error={error} headerTitle={t('neonatalCare')} />;
  if (!evaluateShowWhenExpression(wellChildCareNavGroup.showWhenExpression, patient, activePatientEnrollment)) {
    return (
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('credProgramNotActive')}
        subtitle={t('credProgramNotActiveDescription')}
      />
    );
  }

  return <NeonatalCareTabs patient={patient} patientUuid={patientUuid} />;
}

export const NeonatalCare: React.FC<NeonatalCareProps> = ({ patient: patientProp, patientUuid: patientUuidProp }) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient(patientUuidProp ?? undefined);
  const session = useSession();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;

  if (!patient || !patientUuid || patient.id !== patientUuid) return null;
  if (
    !session?.authenticated ||
    !session.user?.uuid ||
    !userHasAccess(neonatalCarePrivilege, session.user)
  ) {
    return <UnauthorizedState privilege={neonatalCarePrivilege} />;
  }

  return <EnrolledNeonatalCare key={patientUuid} patient={patient} patientUuid={patientUuid} />;
};
