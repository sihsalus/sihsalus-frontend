import { useStoreWithActions } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';

import { getOrCreateGlobalSingleton } from '../store/global-singleton';
import { getPatientUuidFromStore } from '../store/patient-chart-store';

import { type OrderBasketStore, orderBasketStore } from './store';
import type { OrderBasketItem, PostDataPrepFunction } from './types';

interface PostDataPrepRegistration {
  patientUuid?: string;
  current: PostDataPrepFunction | undefined;
}

interface PostDataPrepRegistryEntry {
  registrations: Set<PostDataPrepRegistration>;
  prepare: PostDataPrepFunction;
}

// The basket itself is shared across microfrontend copies of this library. Its
// dispatchers and active owners must be shared in the same way.
const postDataPrepRegistry = getOrCreateGlobalSingleton(
  'order-basket-preparers',
  () => new Map<string, PostDataPrepRegistryEntry>(),
);

function getPostDataPrepRegistryEntry(grouping: string): PostDataPrepRegistryEntry {
  const existing = postDataPrepRegistry.get(grouping);
  if (existing) return existing;
  const registrations = new Set<PostDataPrepRegistration>();
  const entry: PostDataPrepRegistryEntry = {
    registrations,
    prepare: (order, patientUuid, encounterUuid, orderingProviderUuid) => {
      const active = Array.from(registrations).reverse();
      const registration =
        active.find((owner) => owner.patientUuid === patientUuid) ??
        active.find((owner) => owner.patientUuid === undefined);
      if (!registration?.current) {
        throw new Error('No active order preparation is available.');
      }
      return registration.current(order, patientUuid, encounterUuid, orderingProviderUuid);
    },
  };
  postDataPrepRegistry.set(grouping, entry);
  return entry;
}

const orderBasketStoreActions = {
  setOrderBasketItems(
    state: OrderBasketStore,
    grouping: string,
    value: Array<OrderBasketItem> | (() => Array<OrderBasketItem>),
    explicitPatientUuid?: string,
  ) {
    const patientUuid = explicitPatientUuid ?? getPatientUuidFromStore();
    if (!patientUuid) {
      return state;
    }

    if (!Object.keys(state.postDataPrepFunctions).includes(grouping)) {
      console.warn(`Programming error: You must register a postDataPrepFunction for grouping ${grouping} `);
    }
    return {
      items: {
        ...state?.items,
        [patientUuid]: {
          ...state?.items?.[patientUuid],
          [grouping]: typeof value === 'function' ? value() : value,
        },
      },
    };
  },

  setPostDataPrepFunctionForGrouping(state: OrderBasketStore, grouping: string, value: PostDataPrepFunction) {
    return {
      postDataPrepFunctions: {
        ...state.postDataPrepFunctions,
        [grouping]: value,
      },
    };
  },
};

function getOrderItems(
  items: OrderBasketStore['items'],
  grouping?: string | null,
  explicitPatientUuid?: string,
): Array<OrderBasketItem> {
  const patientUuid = explicitPatientUuid ?? getPatientUuidFromStore();
  const patientItems = items?.[patientUuid] ?? {};
  return grouping ? (patientItems[grouping] ?? []) : Object.values(patientItems).flat();
}

export interface ClearOrdersOptions {
  exceptThoseMatching: (order: OrderBasketItem) => boolean;
}

function clearOrders(options?: ClearOrdersOptions, explicitPatientUuid?: string): void {
  const exceptThoseMatchingFcn = options?.exceptThoseMatching ?? ((): boolean => false);
  const patientUuid = explicitPatientUuid ?? getPatientUuidFromStore();
  if (!patientUuid) {
    return;
  }
  const items = orderBasketStore.getState().items;
  const patientItems = items[patientUuid] ?? {};
  const newPatientItems = Object.fromEntries(
    Object.entries(patientItems).map(([grouping, orders]) => [grouping, orders.filter(exceptThoseMatchingFcn)]),
  );
  orderBasketStore.setState((state) => ({
    items: {
      ...state.items,
      [patientUuid]: newPatientItems,
    },
  }));
}

type UseOrderBasketReturn<T, U> = {
  orders: Array<T>;
  clearOrders: (options?: ClearOrdersOptions) => void;
  setOrders: U extends string
    ? (value: Array<T> | (() => Array<T>)) => void
    : (groupingKey: string, value: Array<T> | (() => Array<T>)) => void;
};

/**
 * Allows components to read and write to the order basket.
 *
 * @param grouping: The grouping key for the order basket items. If not provided, `orders` will contain
 *  all order basket items for the current patient, and `setOrders` will require grouping as a parameter.
 * @param postDataPrepFunction A function that will be called on each order before it is posted to the server.
 *  A PostDataPrepFunction must be provided for each grouping, but does not necessarily have to be provided
 *  in every usage of useOrderBasket with a grouping key.
 */
export function useOrderBasket<T extends OrderBasketItem>(): UseOrderBasketReturn<T, undefined>;
export function useOrderBasket<T extends OrderBasketItem>(patient: fhir.Patient): UseOrderBasketReturn<T, undefined>;
export function useOrderBasket<T extends OrderBasketItem>(grouping: string): UseOrderBasketReturn<T, string>;
export function useOrderBasket<T extends OrderBasketItem>(
  patient: fhir.Patient,
  grouping: string,
): UseOrderBasketReturn<T, string>;
export function useOrderBasket<T extends OrderBasketItem>(
  grouping: string,
  postDataPrepFunction: PostDataPrepFunction,
): UseOrderBasketReturn<T, string>;
export function useOrderBasket<T extends OrderBasketItem>(
  patient: fhir.Patient,
  grouping: string,
  postDataPrepFunction: PostDataPrepFunction,
): UseOrderBasketReturn<T, string>;
export function useOrderBasket<T extends OrderBasketItem>(
  patientOrGrouping?: fhir.Patient | string | null,
  groupingOrPostDataPrepFunction?: string | PostDataPrepFunction,
  maybePostDataPrepFunction?: PostDataPrepFunction,
): UseOrderBasketReturn<T, string | undefined> {
  const explicitPatientUuid =
    typeof patientOrGrouping === 'object' && patientOrGrouping != null ? (patientOrGrouping.id ?? '') : undefined;
  const grouping =
    typeof patientOrGrouping === 'string' ? patientOrGrouping : (groupingOrPostDataPrepFunction as string | undefined);
  const postDataPrepFunction =
    typeof patientOrGrouping === 'string'
      ? (groupingOrPostDataPrepFunction as PostDataPrepFunction | undefined)
      : maybePostDataPrepFunction;
  const { items, setOrderBasketItems, setPostDataPrepFunctionForGrouping } = useStoreWithActions(
    orderBasketStore,
    orderBasketStoreActions,
  );
  const orders = getOrderItems(items, grouping, explicitPatientUuid);
  const registration = useRef<PostDataPrepRegistration>({ current: postDataPrepFunction });
  const hasPostDataPrepFunction = Boolean(postDataPrepFunction);

  useEffect(() => {
    // Callback updates do not update the store: several consumers can register
    // the same grouping without their effects repeatedly replacing each other.
    registration.current.current = postDataPrepFunction;
  }, [postDataPrepFunction]);

  useEffect(() => {
    if (!hasPostDataPrepFunction || !grouping) return;
    const owner = registration.current;
    owner.patientUuid = explicitPatientUuid;
    const entry = getPostDataPrepRegistryEntry(grouping);
    entry.registrations.add(owner);
    if (orderBasketStore.getState().postDataPrepFunctions[grouping] !== entry.prepare) {
      setPostDataPrepFunctionForGrouping(grouping, entry.prepare);
    }
    return () => {
      entry.registrations.delete(owner);
    };
  }, [explicitPatientUuid, grouping, hasPostDataPrepFunction, setPostDataPrepFunctionForGrouping]);

  if (typeof grouping === 'string') {
    const setOrders = (value: Array<T> | (() => Array<T>)): void => {
      setOrderBasketItems(grouping, value, explicitPatientUuid);
    };
    return {
      orders,
      clearOrders: (options?: ClearOrdersOptions) => clearOrders(options, explicitPatientUuid),
      setOrders,
    } as unknown as UseOrderBasketReturn<T, string>;
  } else {
    const setOrders = (groupingKey: string, value: Array<T> | (() => Array<T>)): void => {
      setOrderBasketItems(groupingKey, value, explicitPatientUuid);
    };
    return {
      orders,
      clearOrders: (options?: ClearOrdersOptions) => clearOrders(options, explicitPatientUuid),
      setOrders,
    } as unknown as UseOrderBasketReturn<T, undefined>;
  }
}
