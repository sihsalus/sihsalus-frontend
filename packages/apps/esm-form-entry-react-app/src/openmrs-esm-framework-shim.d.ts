declare module '@openmrs/esm-framework' {
  import type React from 'react';

  export interface OpenmrsResource {
    uuid: string;
    display: string;
    [key: string]: unknown;
  }

  export interface Encounter extends OpenmrsResource {
    encounterDatetime?: string;
    [key: string]: unknown;
  }

  export interface Visit {
    uuid: string;
    startDatetime: string;
    stopDatetime?: string | null;
    visitType?: OpenmrsResource;
    encounters: Array<unknown>;
    [key: string]: unknown;
  }

  export interface DefaultWorkspaceProps {
    closeWorkspace: () => void;
    closeWorkspaceWithSavedChanges?: () => void;
    promptBeforeClosing?: (testFcn: () => boolean) => void;
  }

  export interface FetchResponse<T> {
    data: T;
  }

  export interface MessageServiceWorkerResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: string;
  }

  export interface SyncItem<T = unknown> {
    content: T;
  }

  export const restBaseUrl: string;
  export const fhirBaseUrl: string;
  export const omrsOfflineCachingStrategyHttpHeaderName: string;
  export const Type: {
    Array: unknown;
    Boolean: unknown;
    String: unknown;
  };

  export function validator<T>(predicate: (value: T) => boolean, message: string): unknown;
  export function defineConfigSchema(moduleName: string, schema: Record<string, unknown>): void;
  export function getAsyncLifecycle(loader: () => Promise<unknown>, options: Record<string, unknown>): unknown;
  export function makeUrl(path: string): string;
  export function showModal(name: string, props: Record<string, unknown>): () => void;
  export function showSnackbar(config: Record<string, unknown>): void;
  export function useConfig<T = unknown>(): T;
  export function createGlobalStore<T>(name: string, initialState: T): void;
  export function getGlobalStore<T>(name: string): {
    getState(): T;
    setState(state: Partial<T>): void;
    subscribe(listener: (state: T) => void): () => void;
  };
  export function openmrsFetch<T = unknown>(url: string, init?: Record<string, unknown>): Promise<FetchResponse<T>>;
  export function subscribePrecacheStaticDependencies(callback: () => void): void;
  export function setupDynamicOfflineDataHandler(config: {
    id: string;
    type: string;
    displayName: string;
    isSynced(identifier: string): Promise<boolean>;
    sync(identifier: string, abortSignal?: AbortSignal): Promise<void>;
  }): void;
  export function refreshOfflineCacheEntry(url: string, signal?: AbortSignal): Promise<void>;
  export function messageOmrsServiceWorker(
    message: Record<string, unknown>,
  ): Promise<MessageServiceWorkerResult>;
  export function queueSynchronizationItem<T>(type: string, content: T, meta: Record<string, unknown>): Promise<void>;
  export function getFullSynchronizationItems<T>(type: string): Promise<Array<SyncItem<T>>>;

  export const ExtensionSlot: React.ComponentType<Record<string, unknown>>;
}
