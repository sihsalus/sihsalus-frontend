import type {} from '@openmrs/esm-globals';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('@openmrs/esm-api', async () => ({
  ...(await vi.importActual('@openmrs/esm-api')),
  ...(await import('@openmrs/esm-api/mock')),
}));
vi.mock('@openmrs/esm-react-utils', () => import('@openmrs/esm-react-utils/mock'));
vi.mock('@openmrs/esm-translations', () => import('@openmrs/esm-translations/mock'));
vi.mock('@openmrs/esm-utils', () => import('@openmrs/esm-utils/mock'));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

window.openmrsBase = '/openmrs';
window.spaBase = '/spa';
window.getOpenmrsSpaBase = () => '/openmrs/spa/';
window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);
afterEach(vi.resetAllMocks);
