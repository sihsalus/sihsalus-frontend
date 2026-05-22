import {
  type ExtensionSlotCustomState,
  registerExtensionSlot,
  updateExtensionSlotState,
} from '@openmrs/esm-extensions';
import { useContext, useEffect, useRef } from 'react';
import { ComponentContext } from './ComponentContext';
import { useAssignedExtensions } from './useAssignedExtensions';

/** @internal */
export function useExtensionSlot(slotName: string, state?: ExtensionSlotCustomState) {
  const { moduleName } = useContext(ComponentContext);
  const isInitialRender = useRef(true);

  if (!moduleName) {
    throw Error('ComponentContext has not been provided. This should come from @openmrs/esm-react-utils.');
  }

  useEffect(() => {
    registerExtensionSlot(moduleName, slotName, state);
    isInitialRender.current = false;
  }, [state, slotName, moduleName]);

  useEffect(() => {
    if (!isInitialRender.current) {
      updateExtensionSlotState(slotName, state);
    }
  }, [slotName, state]);

  const extensions = useAssignedExtensions(slotName);

  return {
    extensions,
    extensionSlotName: slotName,
    extensionSlotModuleName: moduleName,
  };
}
