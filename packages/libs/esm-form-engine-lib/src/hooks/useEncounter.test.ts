import { renderHook, waitFor } from "@testing-library/react";

import { useEncounter } from "./useEncounter";

const mockOpenmrsFetch = vi.hoisted(() => vi.fn());

vi.mock("@openmrs/esm-framework/src/internal", () => ({
  openmrsFetch: mockOpenmrsFetch,
  restBaseUrl: "/ws/rest/v1",
}));

describe("useEncounter", () => {
  it("clears a previous load failure before loading another encounter", async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(new Error("Forbidden"))
      .mockResolvedValueOnce({ data: { uuid: "encounter-2" } } as never);

    const { result, rerender } = renderHook(
      ({ encounter }) => useEncounter({ encounter } as never),
      { initialProps: { encounter: "encounter-1" } },
    );

    await waitFor(() =>
      expect(result.current.error).toEqual(expect.any(Error)),
    );

    rerender({ encounter: "encounter-2" });

    await waitFor(() =>
      expect(result.current.encounter?.uuid).toBe("encounter-2"),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
