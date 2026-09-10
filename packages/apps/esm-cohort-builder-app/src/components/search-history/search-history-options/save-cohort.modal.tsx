import React from 'react';
import SaveDefinitionModal from './save-definition.modal';

interface SaveCohortModalProps {
  closeModal: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

const SaveCohortModal: React.FC<SaveCohortModalProps> = (props) => <SaveDefinitionModal kind="cohort" {...props} />;

export default SaveCohortModal;
