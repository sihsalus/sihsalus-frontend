import { vi } from 'vitest';

export const openmrsFetch = vi.fn();
export const useConfig = vi.fn();
export const useConfigObject = vi.fn();
export const useSystemSession = vi.fn();

export const configSchema = {};

export const Type = {
  Boolean: 'boolean',
  Number: 'number',
  Object: 'object',
  String: 'string',
};

export const reportError = vi.fn();
export const useConnectivity = vi.fn(() => true);
export const showNotification = vi.fn();
export const showActionableNotification = vi.fn();
export const showToast = vi.fn();
export const showSnackbar = vi.fn();
