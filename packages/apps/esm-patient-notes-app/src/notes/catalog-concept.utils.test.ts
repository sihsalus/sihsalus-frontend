import {
  formatPrestacionalDisplay,
  getCie10DisplayParts,
  getCie10MappedCode,
  getPrestacionalDisplayParts,
} from "./catalog-concept.utils";

describe("catalog concept display", () => {
  it("reads CIE-10 from the concept mapping and puts it before the diagnosis name", () => {
    expect(
      getCie10DisplayParts({
        display: "Diabetes mellitus tipo II",
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: "E11.9",
              conceptSource: { name: "ICD-10-WHO" },
            },
          },
        ],
      }),
    ).toEqual({ code: "E11.9", name: "Diabetes mellitus tipo II" });
  });

  it("keeps supporting CIE-10 codes embedded in legacy concept displays", () => {
    expect(
      getCie10DisplayParts({
        display: "TRASTORNO MENTAL (F15.5)",
      }),
    ).toEqual({ code: "F15.5", name: "TRASTORNO MENTAL" });
  });

  it("accepts any non-empty MINSA catalog code only when its source is CIE-10/ICD-10", () => {
    expect(
      getCie10MappedCode({
        display: "Diagnóstico local",
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: "U07.1X-MINSA",
              conceptSource: { name: "ICD-10" },
            },
          },
        ],
      }),
    ).toBe("U07.1X-MINSA");
    expect(
      getCie10MappedCode({
        display: "Diagnóstico con source visible",
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: "R51",
              conceptSource: { name: "", display: "CIE-10 MINSA" },
            },
          },
        ],
      }),
    ).toBe("R51");
  });

  it("does not treat display text or a mapping from another source as CIE-10 authority", () => {
    expect(
      getCie10MappedCode({ display: "F15.5 - Trastorno mental" }),
    ).toBeUndefined();
    expect(
      getCie10MappedCode({
        display: "Trastorno mental",
        conceptMappings: [{ display: "ICD-10: F15.5" }],
      }),
    ).toBeUndefined();
    expect(
      getCie10MappedCode({
        display: "Trastorno mental",
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: "F15.5",
              conceptSource: { name: "CIEL" },
            },
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("reads a FUA prestational code from its SIS mapping without duplicating it", () => {
    const concept = {
      display: "Consulta externa",
      conceptMappings: [
        {
          conceptReferenceTerm: {
            code: "056",
            conceptSource: { name: "SIS" },
          },
        },
      ],
    };

    expect(getPrestacionalDisplayParts(concept)).toEqual({
      code: "056",
      name: "Consulta externa",
    });
    expect(formatPrestacionalDisplay(concept)).toBe("056 - Consulta externa");
    expect(
      formatPrestacionalDisplay({ display: "056 - Consulta externa" }),
    ).toBe("056 - Consulta externa");
  });
});
