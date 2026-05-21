/**
 * Shared test utilities for all microfrontends.
 *
 * Resolved as the bare `test-utils` module via the shared TypeScript and Jest config.
 * in the root vitest.config.js.
 */

import { type RenderOptions, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';

// ─── Re-export all shared mocks ──────────────────────────────────────────────
export * from './mocks';

// ─── Additional patient mock not in shared fixtures ───────────────────────────
export const mockPatientWithLongName = {
  uuid: 'bfa09dac-ec9e-47c1-9ad3-e3ebdd5d722d',
  name: 'Some very long given name family name',
  gender: 'M',
  age: 20,
  birthdate: '2004-01-01T00:00:00.000+0000',
  identifier: '100TEST',
};

// ─── Route constants ──────────────────────────────────────────────────────────
export const patientChartBasePath = '/patient/:patientUuid/chart';

// ─── SWR render helper ────────────────────────────────────────────────────────
const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

export const renderWithSwr = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: swrWrapper, ...options });

// ─── Router render helper ─────────────────────────────────────────────────────
export function renderWithRouter<T extends object>(
  Component: React.JSXElementConstructor<T>,
  props: T = {} as T,
  { route = '/', routes = [route] }: { route?: string; routes?: string[] } = {},
) {
  return render(
    <MemoryRouter initialEntries={routes} initialIndex={routes.indexOf(route) >= 0 ? routes.indexOf(route) : 0}>
      <Component {...props} />
    </MemoryRouter>,
  );
}

// ─── DOM query helpers ────────────────────────────────────────────────────────
/**
 * getByText variant that matches across multiple DOM nodes (e.g. text split by
 * inline elements). Useful when Carbon / other libs wrap parts of a sentence.
 */
export function getByTextWithMarkup(text: string | RegExp) {
  return screen.getByText((_, node) => {
    if (!node) return false;
    const hasText = (el: Element): boolean =>
      typeof text === 'string' ? el.textContent === text : text.test(el.textContent ?? '');
    return hasText(node as Element) && Array.from(node.children).every((child) => !hasText(child as Element));
  });
}

// ─── Async wait helpers ───────────────────────────────────────────────────────
export async function waitForLoadingToFinish() {
  const loaders = screen.queryAllByRole('progressbar');
  if (loaders.length > 0) {
    await waitForElementToBeRemoved(() => [...screen.queryAllByRole('progressbar')], { timeout: 4000 });
  }
  await waitFor(() => {}, { timeout: 100 }).catch(() => {});
}
