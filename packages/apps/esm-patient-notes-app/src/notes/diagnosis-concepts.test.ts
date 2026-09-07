import { openmrsFetch } from "@openmrs/esm-framework";
import { getCie10MappedCode } from "./catalog-concept.utils";
import { fetchDiagnosisConceptsByName } from "./visit-notes.resource";

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe("fetchDiagnosisConceptsByName", () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it("finds and prioritizes an exact CIE-10 code stored without a dot", async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: "diagnosis-a710",
              display: "Otra coincidencia difusa",
              names: [
                {
                  display: "A710",
                  conceptNameType: "SHORT",
                  locale: "es",
                },
              ],
            },
            {
              uuid: "diagnosis-k710",
              display: "Enfermedad tóxica del hígado con colestasis",
              names: [
                {
                  display: "K710",
                  conceptNameType: "SHORT",
                  locale: "es",
                },
              ],
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: "diagnosis-k710",
              display: "Enfermedad tóxica del hígado con colestasis",
              names: [
                {
                  display: "K710",
                  conceptNameType: "SHORT",
                  locale: "es",
                },
              ],
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    const diagnoses = await fetchDiagnosisConceptsByName(
      "K71.0",
      "diagnosis class",
    );

    expect(diagnoses.map(({ uuid }) => uuid)).toEqual([
      "diagnosis-k710",
      "diagnosis-a710",
    ]);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("name=K710"),
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("name=K71.0"),
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("class=diagnosis%20class"),
    );
  });

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

  it("encodes a diagnosis name without treating it as a CIE-10 code", async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await fetchDiagnosisConceptsByName(
      "dolor & fiebre",
      "diagnosis-class-uuid",
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining("name=dolor%20%26%20fiebre"),
    );
  });
});
