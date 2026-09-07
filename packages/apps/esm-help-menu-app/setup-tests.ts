import { cleanup } from '@testing-library/react';

(window as unknown as { importMapOverrides: unknown }).importMapOverrides = {
  getOverrideMap: vi.fn().mockReturnValue({ imports: {} }),
};

afterEach(cleanup);

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(),
}));
