export { interpolateString, interpolateUrl } from '@openmrs/esm-navigation';

import { vi } from 'vitest';

export const navigate = vi.fn();

export const clearHistory = vi.fn();
