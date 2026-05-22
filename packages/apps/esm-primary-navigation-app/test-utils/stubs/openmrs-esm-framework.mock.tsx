import React from 'react';
import { of } from 'rxjs';
import { vi } from 'vitest';

export const useLayoutType = vi.fn(() => 'tablet');

export function openmrsFetch() {
  return new Promise(() => {});
}

export function getCurrentUser() {
  return of({ authenticated: false });
}

export function createErrorHandler() {
  return true;
}

export function refetchCurrentUser() {
  return Promise.resolve({});
}

export const ComponentContext = React.createContext(null);

export const openmrsComponentDecorator = vi.fn().mockImplementation(() => (component: any) => component);

export const Extension = vi.fn().mockImplementation((_props: any) => {
  return <slot />;
});

export const ExtensionSlot = ({ children }) => <>{children}</>;
