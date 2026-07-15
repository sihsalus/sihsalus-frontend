import type { Stats } from 'node:fs';
import type { Response } from 'express';

export type SpaStaticSetHeaders = (response: Response, filePath: string, stat: Stats) => void;

export function createSpaStaticOptions<T extends Record<string, unknown> = Record<string, never>>(
  options?: T & { setHeaders?: SpaStaticSetHeaders },
): T & { setHeaders: SpaStaticSetHeaders };

export function isSpaIndexRequestPath(requestPath: string, spaPath: string): boolean;

export function setSpaStaticAssetHeaders(response: Response, filePath: string): void;
