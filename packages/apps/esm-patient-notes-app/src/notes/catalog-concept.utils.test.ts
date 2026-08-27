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

  it("reads CIE-10 from the catalog SHORT name when the concept has no mapping", () => {
    // The MINSA catalog stores the code as the SHORT name and ships no mappings.
    const concept = {
      display: "TUMOR MALIGNO DE LA CARA DORSAL DE LA LENGUA",
      conceptMappings: [],
      names: [
        {
          display: "TUMOR MALIGNO DE LA CARA DORSAL DE LA LENGUA",
          conceptNameType: "FULLY_SPECIFIED",
        },
        { display: "C020", conceptNameType: "SHORT" },
      ],
    };

    expect(getCie10DisplayParts(concept)).toEqual({
      code: "C020",
      name: "TUMOR MALIGNO DE LA CARA DORSAL DE LA LENGUA",
    });
    expect(getCie10MappedCode(concept)).toBe("C020");
  });

  it("prefers an explicit CIE-10 mapping over the SHORT name", () => {
    expect(
      getCie10MappedCode({
        display: "Cefalea",
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: "R51",
              conceptSource: { name: "ICD-10-WHO" },
            },
          },
        ],
        names: [{ display: "R51-LOCAL", conceptNameType: "SHORT" }],
      }),
    ).toBe("R51");
  });

  it("ignores a SHORT name that is not shaped like a CIE-10 code", () => {
    expect(
      getCie10MappedCode({
        display: "Hipertensión",
        names: [{ display: "HTA", conceptNameType: "SHORT" }],
      }),
    ).toBeUndefined();
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
