import {
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
  type Session,
} from '@openmrs/esm-framework';

import { type BulkPatientImportConfig, isCanonicalUtcInstant } from '../config-schema';

export const bulkPatientImportLockName = 'sihsalus-bulk-patient-import-v1';
export const bulkPatientImportSafetyErrorMessage =
  'The bulk patient import safety check failed. No additional patients were created.';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const superUserRoleNames = new Set(['System Developer', 'Application: Has Super User Privileges']);

interface BuildInfo {
  gitSha?: string;
}

export interface BulkPatientImportExecutionContext {
  fileSha256: string;
  userUuid: string;
  locationUuid: string;
  config: BulkPatientImportConfig;
}

/**
 * Serializes the one-time import across same-origin browser tabs. Unlike the
 * ordinary queue locks, this operation deliberately has no fallback: running a
 * clinical migration without a cross-tab lock is not an acceptable downgrade.
 */
export async function withBulkPatientImportLock<T>(operation: () => Promise<T>): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (!lockManager) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }

  try {
    return await lockManager.request(
      bulkPatientImportLockName,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) {
          throw new Error(bulkPatientImportSafetyErrorMessage);
        }
        return operation();
      },
    );
  } catch {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }
}

/**
 * Revalidates the immutable approval and the live session immediately before
 * preflight and again before each patient write. All outward failures are
 * deliberately fixed and identifier-free.
 */
export async function assertFreshBulkPatientImportContext(
  expected: BulkPatientImportExecutionContext,
  signal?: AbortSignal,
): Promise<void> {
  const timeoutController = new AbortController();
  const abortForCaller = () => timeoutController.abort();
  const timeout = globalThis.setTimeout(() => timeoutController.abort(), 15_000);
  if (signal?.aborted) {
    timeoutController.abort();
  }
  signal?.addEventListener('abort', abortForCaller, { once: true });

  try {
    assertConfiguredApproval(expected);

    const [session, buildInfo] = await Promise.all([
      fetchFreshSession(timeoutController.signal),
      fetchFreshBuildInfo(timeoutController.signal),
    ]);
    assertConfiguredApproval(expected);
    const liveUserUuid = session.user?.uuid;
    const liveLocationUuid = session.sessionLocation?.uuid;

    if (
      !session.authenticated ||
      !liveUserUuid ||
      !liveLocationUuid ||
      liveUserUuid !== expected.userUuid ||
      liveUserUuid !== expected.config.approvedUserUuid ||
      liveLocationUuid !== expected.locationUuid ||
      liveLocationUuid !== expected.config.approvedLocationUuid ||
      !hasManagePatientsPrivilege(session) ||
      buildInfo.gitSha?.toLowerCase() !== expected.config.approvedBuildSha.toLowerCase()
    ) {
      throw new Error(bulkPatientImportSafetyErrorMessage);
    }
  } catch {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortForCaller);
  }
}

function assertConfiguredApproval(expected: BulkPatientImportExecutionContext) {
  const { config } = expected;
  const configuredOrigin = normalizeOrigin(config.approvedOrigin);

  if (
    !config.enabled ||
    !configuredOrigin ||
    configuredOrigin !== globalThis.location.origin ||
    !/^[a-f0-9]{64}$/.test(config.approvedFileSha256) ||
    !/^[a-f0-9]{40}$/.test(config.approvedBuildSha) ||
    !isCanonicalUtcInstant(config.approvalExpiresAt) ||
    Date.parse(config.approvalExpiresAt) <= Date.now() ||
    !canonicalUuidPattern.test(config.approvedUserUuid) ||
    !canonicalUuidPattern.test(config.approvedLocationUuid) ||
    expected.fileSha256.toLowerCase() !== config.approvedFileSha256.toLowerCase() ||
    !['address4', 'cityVillage'].includes(config.domicilioTarget)
  ) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }
}

async function fetchFreshSession(signal?: AbortSignal): Promise<Session> {
  const url = new URL(`${restBaseUrl}/session`, globalThis.location.origin);
  url.searchParams.set('_bulkPatientImportCheck', globalThis.crypto.randomUUID());
  const response = await openmrsFetch<Session>(url.href, {
    cache: 'no-store',
    headers: {
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
    rejectOnAuthFailure: true,
    signal,
  });

  if (!response.ok) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }
  return response.data;
}

async function fetchFreshBuildInfo(signal?: AbortSignal): Promise<BuildInfo> {
  const spaBase = globalThis.getOpenmrsSpaBase?.() ?? globalThis.spaBase;
  if (!spaBase) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }

  const url = new URL(`${spaBase.replace(/\/?$/, '/')}build-info.json`, globalThis.location.origin);
  url.searchParams.set('_bulkPatientImportCheck', globalThis.crypto.randomUUID());
  const response = await globalThis.fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }

  const data = (await response.json()) as BuildInfo;
  if (!data.gitSha || !/^[a-f0-9]{40}$/i.test(data.gitSha)) {
    throw new Error(bulkPatientImportSafetyErrorMessage);
  }
  return data;
}

function hasManagePatientsPrivilege(session: Session): boolean {
  const user = session.user;
  if (!user) {
    return false;
  }

  const hasPrivilege = user.privileges?.some(
    (privilege) => privilege.name === 'Manage Patients' || privilege.display === 'Manage Patients',
  );
  const isSuperUser = user.roles?.some(
    (role) => superUserRoleNames.has(role.name) || superUserRoleNames.has(role.display),
  );
  return Boolean(hasPrivilege || isSuperUser);
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.href === `${url.origin}/` || url.href === url.origin ? url.origin : null;
  } catch {
    return null;
  }
}
