import { type APIRequestContext } from '@playwright/test';

export interface OpenmrsCleanupTarget {
  resource: 'encounter' | 'order' | 'patient' | 'visit';
  uuid: string;
}

const cleanupReason = 'Automated E2E cleanup';

/**
 * Voids a synthetic resource and verifies the outcome. A successful DELETE is
 * not enough: some OpenMRS endpoints can return 200 while leaving the resource
 * active when the reason is missing or the delete handler is incomplete.
 */
export async function voidOpenmrsResource(
  api: APIRequestContext,
  { resource, uuid }: OpenmrsCleanupTarget,
): Promise<void> {
  const response = await api.delete(
    `${resource}/${encodeURIComponent(uuid)}?reason=${encodeURIComponent(cleanupReason)}`,
    { data: {} },
  );
  const verification = await api.get(
    `${resource}/${encodeURIComponent(uuid)}?v=${encodeURIComponent('custom:(uuid,voided)')}`,
  );

  if (verification.status() === 404) {
    return;
  }
  if (verification.ok()) {
    const body = (await verification.json()) as { voided?: boolean };
    if (body.voided) {
      return;
    }
  }

  throw new Error(
    `Synthetic E2E cleanup failed for ${resource} (${response.status()}); verification returned ${verification.status()}.`,
  );
}

/** Attempts every dependency-ordered cleanup target before reporting errors. */
export async function voidOpenmrsResources(
  api: APIRequestContext,
  targets: Array<OpenmrsCleanupTarget | undefined>,
): Promise<void> {
  const errors: Array<Error> = [];

  for (const target of targets) {
    if (!target) continue;
    try {
      await voidOpenmrsResource(api, target);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (errors.length) {
    throw new AggregateError(errors, `Synthetic E2E cleanup failed for ${errors.length} resource(s).`);
  }
}
