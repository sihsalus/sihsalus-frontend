import { Workspace2 } from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import FuaHtmlViewer from '../components/fua-html-viewer.component';

interface LegacyFuaViewerWorkspaceProps extends DefaultPatientWorkspaceProps {
  fuaId?: string;
  visitUuid?: string;
}

type Workspace2FuaViewerWorkspaceProps = PatientWorkspace2DefinitionProps<
  { fuaId?: string; visitUuid?: string },
  object
>;
type FuaViewerWorkspaceProps = LegacyFuaViewerWorkspaceProps | Workspace2FuaViewerWorkspaceProps;

function isWorkspace2Props(props: FuaViewerWorkspaceProps): props is Workspace2FuaViewerWorkspaceProps {
  return 'workspaceProps' in props && 'groupProps' in props;
}

const FuaViewerWorkspace: React.FC<FuaViewerWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const fuaId = isWorkspace2Props(props) ? props.workspaceProps?.fuaId : props.fuaId;
  const visitUuid = isWorkspace2Props(props) ? props.workspaceProps?.visitUuid : props.visitUuid;
  const content = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FuaHtmlViewer fuaId={fuaId} visitUuid={visitUuid} />
    </div>
  );

  if (isWorkspace2Props(props)) {
    return <Workspace2 title={t('viewFua', 'Ver FUA')}>{content}</Workspace2>;
  }

  return content;
};

export default FuaViewerWorkspace;
