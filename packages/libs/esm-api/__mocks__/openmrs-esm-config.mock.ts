import { vi } from 'vitest';

export const defineConfigSchema = vi.fn();

export const getConfig = vi.fn().mockResolvedValue({ redirectAuthFailure: { enabled: false } });
