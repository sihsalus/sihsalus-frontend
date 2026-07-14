import { createGlobalStore } from '@openmrs/esm-state';
import { type LifeCycles } from 'single-spa';
import { getExtensionRegistration } from '.';

/** @internal */
export interface ModalRegistration {
  name: string;
  load(): Promise<LifeCycles>;
  moduleName: string;
  privileges?: string | Array<string>;
}

interface ModalRegistry {
  /** Modals indexed by name */
  modals: Record<string, ModalRegistration>;
}

const modalRegistryStore = createGlobalStore<ModalRegistry>('modalRegistry', {
  modals: {},
});

/** @internal */
export function registerModal(modalRegistration: ModalRegistration) {
  modalRegistryStore.setState((state) => {
    const existingRegistration = state.modals[modalRegistration.name];
    if (existingRegistration && existingRegistration.moduleName !== modalRegistration.moduleName) {
      throw new Error(
        `Modal '${modalRegistration.name}' is already registered by '${existingRegistration.moduleName}' and cannot be replaced by '${modalRegistration.moduleName}'.`,
      );
    }

    return {
      modals: {
        ...state.modals,
        [modalRegistration.name]: modalRegistration,
      },
    };
  });
}

/** @internal */
export function getModalRegistration(modalName: string): ModalRegistration | undefined {
  let modalRegistration = modalRegistryStore.getState().modals[modalName];
  if (!modalRegistration) {
    const extensionRegistration = getExtensionRegistration(modalName);
    if (extensionRegistration) {
      modalRegistration = {
        name: modalName,
        load: extensionRegistration.load,
        moduleName: extensionRegistration.moduleName,
        privileges: extensionRegistration.privileges,
      };
      console.warn(
        `Modal ${modalName} was registered as an extension. This is deprecated and will be removed in the future. Please register it in the "modals" section of routes.json instead of the "extensions" section.`,
      );
      // Register it so the warning only appears once
      registerModal(modalRegistration);
    }
  }
  return modalRegistration;
}
