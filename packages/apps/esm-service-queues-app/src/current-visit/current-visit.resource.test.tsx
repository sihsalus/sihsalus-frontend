import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import { useVisit } from "./current-visit.resource";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

const mockUseSWR = vi.mocked(useSWR);

describe("useVisit clinical representation", () => {
  beforeEach(() => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
  });

  it("requests the visit location and structured diagnoses with a balanced representation", () => {
    renderHook(() => useVisit("visit-uuid"));

    const key = mockUseSWR.mock.calls[0][0] as string;
    const representation =
      new URL(key, "https://openmrs.test").searchParams.get("v") ?? "";

    expect(representation).toContain("location:(uuid,display)");
    expect(representation).toContain(
      "diagnoses:(uuid,display,certainty,rank,voided",
    );
    expect(representation).toContain(
      "obsDatetime,voided,formFieldNamespace,formFieldPath",
    );
    expect(representation.split("(")).toHaveLength(
      representation.split(")").length,
    );
  });

  it("does not request an unscoped visit when its UUID is absent", () => {
    renderHook(() => useVisit());

    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });
});
