import type { request } from 'node:https';
export interface PreflightConfig {
  origin: string;
  allowSelfSigned: boolean;
  authorization: string;
}
export interface MetadataClient {
  get(value: string): Promise<unknown>;
}
export const devOrigin: string;
export const formNames: string[];
export function readPreflightConfig(environment?: NodeJS.ProcessEnv): PreflightConfig;
export function validateMetadataUrl(value: string, config: PreflightConfig): URL;
export function createMetadataClient(config: PreflightConfig, transport?: typeof request): MetadataClient;
export function safeErrorCode(error: unknown): string;
export function inventoryEnvironment(
  client: MetadataClient,
  onMetadata?: (section: string, data: unknown) => void,
): Promise<Record<string, unknown>>;
