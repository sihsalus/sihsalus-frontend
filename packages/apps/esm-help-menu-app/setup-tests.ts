import type {} from '@openmrs/esm-framework';
import { cleanup } from '@testing-library/react';

vi.mock('@openmrs/esm-framework', () => require('@openmrs/esm-framework/mock'));

(window as unknown as { importMapOverrides: unknown }).importMapOverrides = {
  getOverrideMap: vi.fn().mockReturnValue({ imports: {} }),
};

afterEach(cleanup);

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(),
}));
