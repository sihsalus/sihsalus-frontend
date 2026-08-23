import routes from "./routes.json";

describe("clinical form workspace privilege contract", () => {
  it("guards every patient-chart form workspace as well as its window", () => {
    const chartWorkspaceNames = [
      "clinical-forms-workspace",
      "patient-form-entry-workspace",
      "patient-form-entry-workspace-v2",
      "patient-html-form-entry-workspace",
    ];

    chartWorkspaceNames.forEach((name) => {
      expect(
        routes.workspaces2.find((workspace) => workspace.name === name)
          ?.privileges,
      ).toBe("app:hoja.clinica.formulariosClinicos");
    });

    expect(
      routes.workspaceWindows2.find(
        (window) => window.name === "patient-chart-clinical-forms",
      )?.privileges,
    ).toBe("app:hoja.clinica.formulariosClinicos");
  });
});
