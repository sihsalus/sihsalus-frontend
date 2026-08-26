import { openmrsFetch } from "@openmrs/esm-framework";
import { getCie10MappedCode } from "./catalog-concept.utils";
import { fetchDiagnosisConceptsByName } from "./visit-notes.resource";

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe("fetchDiagnosisConceptsByName", () => {
  it("requests enough source metadata to validate a display-only CIE-10 mapping", async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: "diagnosis-e119",
            display: "Diabetes mellitus tipo II",
            conceptMappings: [
              {
                conceptReferenceTerm: {
                  code: "E11.9",
                  conceptSource: { name: "", display: "ICD-10-WHO" },
                },
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const [diagnosis] = await fetchDiagnosisConceptsByName(
      "diabetes",
      "diagnosis-class-uuid",
    );

    expect(getCie10MappedCode(diagnosis)).toBe("E11.9");
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "conceptMappings:(conceptReferenceTerm:(conceptSource:(name,display),code))",
      ),
    );
  });
});
