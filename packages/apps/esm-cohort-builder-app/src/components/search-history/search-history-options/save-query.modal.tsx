import React from 'react';
import SaveDefinitionModal from './save-definition.modal';

export interface SaveQueryFormData {
  queryName: string;
  queryDescription: string;
}

interface SaveQueryModalProps {
  closeModal: () => void;
  onSaveQuery: (data: SaveQueryFormData) => Promise<void>;
}

const SaveQueryModal: React.FC<SaveQueryModalProps> = ({ closeModal, onSaveQuery }) => (
  <SaveDefinitionModal
    kind="query"
    closeModal={closeModal}
    onSave={(queryName, queryDescription) => onSaveQuery({ queryName, queryDescription })}
  />
);

export default SaveQueryModal;
