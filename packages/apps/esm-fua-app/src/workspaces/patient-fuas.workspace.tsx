import { Workspace2 } from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import FuaPatientWidget from '../components/fua-patient-widget.component';
import { fuaReadPrivilege } from '../constant';

interface LegacyPatientFuasWorkspaceProps extends DefaultPatientWorkspaceProps {
  patientUuid: string;
}

type Workspace2PatientFuasWorkspaceProps = PatientWorkspace2DefinitionProps<{ patientUuid?: string }, object>;
type PatientFuasWorkspaceProps = LegacyPatientFuasWorkspaceProps | Workspace2PatientFuasWorkspaceProps;

function isWorkspace2Props(props: PatientFuasWorkspaceProps): props is Workspace2PatientFuasWorkspaceProps {
  return 'workspaceProps' in props && 'groupProps' in props;
}

const PatientFuasWorkspace: React.FC<PatientFuasWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const patientUuid = isWorkspace2Props(props)
    ? (props.workspaceProps?.patientUuid ?? props.groupProps.patientUuid)
    : props.patientUuid;

  const content = (
    <div style={{ padding: '1rem' }}>
      <FuaPatientWidget patientUuid={patientUuid} maxItems={null} />
    </div>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={t('patientFuasWorkspaceTitle', 'FUAs del paciente')}>
        <RequirePrivilege privilege={fuaReadPrivilege}>{content}</RequirePrivilege>
      </Workspace2>
    );
  }

  return <RequirePrivilege privilege={fuaReadPrivilege}>{content}</RequirePrivilege>;
};

export default PatientFuasWorkspace;
