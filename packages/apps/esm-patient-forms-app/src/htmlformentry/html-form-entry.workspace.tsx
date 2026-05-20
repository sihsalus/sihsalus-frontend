import { usePatient, Workspace2 } from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type LegacyFormEntryInfo } from '../forms/legacy-form-entry';

import HtmlFormEntryWrapper from './html-form-entry-wrapper.component';

interface HtmlFormEntryWorkspaceProps {
  formInfo: LegacyFormEntryInfo;
}

type LegacyHtmlFormEntryProps = DefaultPatientWorkspaceProps & HtmlFormEntryWorkspaceProps;
type Workspace2HtmlFormEntryProps = PatientWorkspace2DefinitionProps<HtmlFormEntryWorkspaceProps, object>;
type HtmlFormEntryComponentProps = LegacyHtmlFormEntryProps | Workspace2HtmlFormEntryProps;

function isWorkspace2Props(props: HtmlFormEntryComponentProps): props is Workspace2HtmlFormEntryProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const HtmlFormEntry: React.FC<HtmlFormEntryComponentProps> = (props) => {
  const { t } = useTranslation();
  const isWorkspace2 = isWorkspace2Props(props);
  const patientUuid = isWorkspace2 ? props.groupProps.patientUuid : props.patientUuid;
  const closeWorkspaceWithSavedChanges = isWorkspace2
    ? () => {
        void props.closeWorkspace({ discardUnsavedChanges: true });
      }
    : props.closeWorkspaceWithSavedChanges;
  const promptBeforeClosing = isWorkspace2 ? null : props.promptBeforeClosing;
  const formInfo = isWorkspace2 ? props.workspaceProps.formInfo : props.formInfo;
  const { patient } = usePatient(patientUuid);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const { encounterUuid, visitUuid, htmlForm } = formInfo || {};

  // we always want to prompt the user before closing/hiding the workspace because we can't guarantee maintaining the state of the form
  promptBeforeClosing?.(() => true);

  // urls for entering a new form and editing an existing form; note that we specify the returnUrl as post-message:close-workspace,
  // which tells HFE-UI to send a message to the parent window to close the workspace when the form is saved or cancelled
  const url = `${globalThis.openmrsBase}/htmlformentryui/htmlform/${
    htmlForm.formUiPage
  }.page?patientId=${patientUuid}&visitId=${visitUuid ?? currentVisit?.uuid ?? null}&definitionUiResource=${
    htmlForm.formUiResource
  }&returnUrl=post-message:close-workspace`;
  const urlWithEncounter = `${globalThis.openmrsBase}/htmlformentryui/htmlform/${
    htmlForm.formEditUiPage
  }.page?patientId=${patientUuid}&visitId=${
    visitUuid ?? currentVisit?.uuid ?? null
  }&encounterId=${encounterUuid}&definitionUiResource=${
    htmlForm.formUiResource
  }&returnUrl=post-message:close-workspace`;

  const showFormAndLoadedData = formInfo && patientUuid && patient;
  const content = (
    <div>
      {showFormAndLoadedData && (
        <HtmlFormEntryWrapper
          src={encounterUuid ? urlWithEncounter : url}
          closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
        />
      )}
    </div>
  );

  if (isWorkspace2) {
    return (
      <Workspace2 title={formInfo?.name ?? t('clinicalForm', 'Clinical form')} hasUnsavedChanges>
        {content}
      </Workspace2>
    );
  }

  return content;
};

export default HtmlFormEntry;
