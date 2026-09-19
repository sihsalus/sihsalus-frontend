import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSynchronizationItem,
  getSessionStore,
  queueSynchronizationItem,
  setupOfflineSync,
} from "@openmrs/esm-framework";
import { registerCase, SurveillanceApiError } from "./api";
import { saveCase, setupSurveillanceSync } from "./offline";
import { request } from "./test-fixtures";
const state = vi.hoisted(() => ({
  session: { authenticated: true, user: { uuid: "user" } },
}));
vi.mock("@openmrs/esm-framework", () => ({
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
  openmrsFetch: vi.fn(),
  getSessionStore: vi.fn(() => ({ getState: () => state })),
  userHasAccess: vi.fn(() => true),
  deleteSynchronizationItem: vi.fn(),
  queueSynchronizationItem: vi.fn(),
  setupOfflineSync: vi.fn(),
  getFullSynchronizationItemsFor: vi.fn(),
}));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  registerCase: vi.fn(),
}));
describe("durable case queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = { authenticated: true, user: { uuid: "user" } };
    vi.mocked(queueSynchronizationItem).mockResolvedValue(5);
    vi.mocked(registerCase).mockResolvedValue({ uuid: "case" } as never);
  });
  it("queues offline without posting", async () => {
    expect(await saveCase(request, "user", false)).toEqual({ queued: true });
    expect(queueSynchronizationItem).toHaveBeenCalledWith(
      expect.any(String),
      request,
      { id: "case" },
    );
    expect(registerCase).not.toHaveBeenCalled();
  });
  it("commits locally before writing and deletes only after acknowledgement", async () => {
    expect((await saveCase(request, "user", true)).queued).toBe(false);
    expect(
      vi.mocked(queueSynchronizationItem).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(registerCase).mock.invocationCallOrder[0]);
    expect(deleteSynchronizationItem).toHaveBeenCalledWith(5);
  });
  it("retains the same idempotency key after a lost response", async () => {
    vi.mocked(registerCase).mockRejectedValue(
      new SurveillanceApiError("SERVICE_UNAVAILABLE", 0),
    );
    expect(await saveCase(request, "user", true)).toEqual({ queued: true });
    expect(deleteSynchronizationItem).not.toHaveBeenCalled();
    expect(registerCase).toHaveBeenCalledWith(request);
  });
  it.each([401, 403, 409, 422])(
    "keeps rejected records for review on HTTP %s",
    async (status) => {
      vi.mocked(registerCase).mockRejectedValue(
        new SurveillanceApiError("ACCESS_DENIED", status),
      );
      await expect(saveCase(request, "user", true)).rejects.toMatchObject({
        status,
      });
      expect(deleteSynchronizationItem).not.toHaveBeenCalled();
    },
  );
  it("does not queue under a different user", async () => {
    await expect(
      saveCase(request, "another-user", false),
    ).rejects.toMatchObject({ status: 401 });
    expect(queueSynchronizationItem).not.toHaveBeenCalled();
  });
  it("does not delete a pending record if the session changes during a request", async () => {
    vi.mocked(registerCase).mockImplementation(async () => {
      state.session.authenticated = false;
      return { uuid: "case" } as never;
    });
    await expect(saveCase(request, "user", true)).rejects.toMatchObject({
      status: 401,
    });
    expect(deleteSynchronizationItem).not.toHaveBeenCalled();
  });
  it("registers an offline handler which rejects an expired session", async () => {
    setupSurveillanceSync();
    state.session.authenticated = false;
    const handler = vi.mocked(setupOfflineSync).mock.calls[0][2];
    await expect(
      handler(request, {
        userId: "user",
        abort: new AbortController(),
      } as never),
    ).rejects.toMatchObject({ status: 401 });
    expect(registerCase).not.toHaveBeenCalled();
    expect(getSessionStore).toHaveBeenCalled();
  });
});
