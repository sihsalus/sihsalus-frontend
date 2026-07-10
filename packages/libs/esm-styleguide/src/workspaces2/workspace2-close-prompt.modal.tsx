import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-translations';
import React from 'react';
import styles from './workspace2-close-prompt.module.scss';

interface WorkspaceUnsavedChangesModal {
  onConfirm: () => void;
  onCancel: () => void;
  affectedWorkspaceTitles: string[];
}

/**
 * This modal is used for prompting user to confirm closing currently opened workspace.
 */
const Workspace2ClosePromptModal: React.FC<WorkspaceUnsavedChangesModal> = ({
  onConfirm,
  onCancel,
  affectedWorkspaceTitles,
}) => {
  return (
    <>
      <ModalHeader closeModal={onCancel} title={getCoreTranslation('closeWorkspaces2PromptTitle')} />
      <ModalBody>
        <p>{getCoreTranslation('closeWorkspaces2PromptBody')}</p>
        <ul className={styles.workspaceList}>
          {affectedWorkspaceTitles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onCancel}>
          {getCoreTranslation('cancel', 'Cancel')}
        </Button>
        <Button dangerDescription={`${getCoreTranslation('danger', 'Danger')}: `} kind="danger" onClick={onConfirm}>
          {getCoreTranslation('discardChanges', 'Discard changes')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default Workspace2ClosePromptModal;
