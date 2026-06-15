/** @module @category Extension */
import { type LifeCycles, mountRootParcel, type Parcel, type ParcelConfig } from 'single-spa';
import { getExtensionNameFromId, getExtensionRegistration } from './extensions';
import { checkStatus } from './helpers';
import { updateInternalExtensionStore } from './store';

type ParcelTimeouts = {
  bootstrap: { millis: number; dieOnTimeout: boolean; warningMillis: number };
  mount: { millis: number; dieOnTimeout: boolean; warningMillis: number };
  update: { millis: number; dieOnTimeout: boolean; warningMillis: number };
  unmount: { millis: number; dieOnTimeout: boolean; warningMillis: number };
};

type LifeCyclesWithTimeouts = LifeCycles & {
  timeouts?: Partial<ParcelTimeouts>;
};

const extensionParcelTimeouts: ParcelTimeouts = {
  bootstrap: { millis: 10000, dieOnTimeout: false, warningMillis: 10000 },
  mount: { millis: 10000, dieOnTimeout: false, warningMillis: 10000 },
  update: { millis: 10000, dieOnTimeout: false, warningMillis: 10000 },
  unmount: { millis: 10000, dieOnTimeout: false, warningMillis: 10000 },
};

function getExtensionParcelTimeouts(overrides: Partial<ParcelTimeouts> | undefined): ParcelTimeouts {
  return {
    bootstrap: { ...extensionParcelTimeouts.bootstrap, ...overrides?.bootstrap },
    mount: { ...extensionParcelTimeouts.mount, ...overrides?.mount },
    update: { ...extensionParcelTimeouts.update, ...overrides?.update },
    unmount: { ...extensionParcelTimeouts.unmount, ...overrides?.unmount },
  };
}

export interface CancelLoading {
  (): void;
}

let parcelCount = 0;

/**
 * Mounts into a DOM node (representing an extension slot)
 * a lazy-loaded component from *any* frontend module
 * that registered an extension component for this slot.
 */
export async function renderExtension(
  domElement: HTMLElement,
  extensionSlotName: string,
  extensionSlotModuleName: string,
  extensionId: string,
  renderFunction: (application: ParcelConfig) => ParcelConfig = (x) => x,
  additionalProps: Record<string, any> = {},
): Promise<Parcel | null> {
  const extensionName = getExtensionNameFromId(extensionId);
  const extensionRegistration = getExtensionRegistration(extensionId);
  let parcel: Parcel | null = null;

  if (domElement) {
    if (!extensionRegistration) {
      throw Error(`Couldn't find extension '${extensionName}' to attach to '${extensionSlotName}'`);
    }

    const { meta, moduleName, online, offline, load } = extensionRegistration;

    if (checkStatus(online, offline)) {
      updateInternalExtensionStore((state) => {
        const instance = {
          domElement,
          id: extensionId,
          slotName: extensionSlotName,
          slotModuleName: extensionSlotModuleName,
        };
        return {
          ...state,
          extensions: {
            ...state.extensions,
            [extensionName]: {
              ...state.extensions[extensionName],
              instances: [...state.extensions[extensionName].instances, instance],
            },
          },
        };
      });

      const lifecycle = (await load()) as LifeCyclesWithTimeouts;
      const id = parcelCount++;
      const timeouts = getExtensionParcelTimeouts(lifecycle.timeouts);

      parcel = mountRootParcel(
        renderFunction({
          ...lifecycle,
          name: `${extensionSlotName}/${extensionName}-${id}`,
          timeouts,
        } as ParcelConfig),
        {
          ...additionalProps,
          _meta: meta,
          _extensionContext: {
            extensionId,
            extensionSlotName,
            extensionSlotModuleName,
            extensionModuleName: moduleName,
          },
          domElement,
        },
      );
    }
  } else {
    console.warn(`Tried to render ${extensionId} into ${extensionSlotName} but no DOM element was available.`);
  }

  return parcel;
}
