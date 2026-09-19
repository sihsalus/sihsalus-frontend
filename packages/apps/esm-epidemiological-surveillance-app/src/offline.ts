import {
  deleteSynchronizationItem,
  getFullSynchronizationItemsFor,
  getSessionStore,
  queueSynchronizationItem,
  setupOfflineSync,
  userHasAccess,
} from "@openmrs/esm-framework";
import { registerCase, safeError, SurveillanceApiError } from "./api";
import { caseRegisterPrivilege, caseViewPrivilege } from "./constants";
import type { CaseRequest, CaseResult } from "./types";

export const syncType = "sihsalus-epidemiological-surveillance-case-v1";
function assertOwner(userUuid: string): void {
  const session = getSessionStore().getState().session;
  if (!session?.authenticated || session.user?.uuid !== userUuid)
    throw new SurveillanceApiError("AUTHENTICATION_REQUIRED", 401);
  if (
    !userHasAccess(caseRegisterPrivilege, session.user) ||
    !userHasAccess(caseViewPrivilege, session.user)
  )
    throw new SurveillanceApiError("ACCESS_DENIED", 403);
}
export function setupSurveillanceSync(): void {
  setupOfflineSync<CaseRequest>(syncType, [], async (request, options) => {
    assertOwner(options.userId);
    return registerCase(request, options.abort.signal);
  });
}
export async function saveCase(
  request: CaseRequest,
  userUuid: string,
  online: boolean,
): Promise<{ queued: boolean; result?: CaseResult }> {
  assertOwner(userUuid);
  // Commit locally before the network write; a lost response retains the same server idempotency key.
  const id = await queueSynchronizationItem(syncType, request, {
    id: request.uuid,
  });
  if (!online) return { queued: true };
  try {
    assertOwner(userUuid);
    const result = await registerCase(request);
    assertOwner(userUuid);
    await deleteSynchronizationItem(id);
    return { queued: false, result };
  } catch (error) {
    const failure = safeError(error);
    if (failure.status === 0 || failure.status >= 500) return { queued: true };
    throw failure; // Validation, authorization and duplicate conflicts remain queued for review.
  }
}
export const pendingCases = (userUuid: string) =>
  getFullSynchronizationItemsFor<CaseRequest>(userUuid, syncType);
