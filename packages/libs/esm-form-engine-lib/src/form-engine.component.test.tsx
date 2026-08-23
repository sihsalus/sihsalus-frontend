import { act, render, screen } from "@testing-library/react";
import React from "react";

import FormEngine from "./form-engine.component";

const mockFormProcessorFactory = vi.fn(
  (_props: { onDependencyError: (error: unknown) => void }) => null,
);
const mockUsePatientData = vi.fn();

vi.mock(".", () => ({
  isEmpty: (value: unknown) =>
    value === null || value === undefined || value === "",
  useFormJson: () => ({
    formError: undefined,
    formJson: {
      name: "Synthetic form",
      pages: [],
      processor: "EncounterFormProcessor",
      uuid: "form-uuid",
    },
    isLoading: false,
  }),
}));

vi.mock("@openmrs/esm-framework/src/internal", () => ({
  useSession: () => ({
    currentProvider: { uuid: "provider-uuid" },
    sessionLocation: { uuid: "location-uuid" },
  }),
}));

vi.mock("react-i18next", () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock(
  "./components/processor-factory/form-processor-factory.component",
  () => ({
    default: (props: { onDependencyError: (error: unknown) => void }) =>
      mockFormProcessorFactory(props),
  }),
);

vi.mock("./components/sidebar/usePageObserver", () => ({
  usePageObserver: () => ({ hasMultiplePages: false }),
}));

vi.mock("./hooks/useFormCollapse", () => ({
  useFormCollapse: () => ({
    hideFormCollapseToggle: vi.fn(),
    isFormExpanded: true,
  }),
}));

vi.mock("./hooks/useFormWorkspaceSize", () => ({
  useFormWorkspaceSize: () => "narrow",
}));

vi.mock("./hooks/usePatientData", () => ({
  usePatientData: (...args: Array<unknown>) => mockUsePatientData(...args),
}));

vi.mock("./lifecycle", () => ({
  init: vi.fn(),
  teardown: vi.fn(),
}));

vi.mock("./provider/form-factory-provider", () => ({
  FormFactoryProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("./utils/form-location", () => ({
  resolveFormLocation: () => ({ uuid: "location-uuid" }),
}));

describe("FormEngine encounter load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatientData.mockReturnValue({
      isLoadingPatient: false,
      patient: { id: "patient-uuid" },
      patientError: undefined,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces the editable form with a safe error state after a 403", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <FormEngine
        encounterUUID="encounter-uuid"
        formJson={{ uuid: "form-uuid" } as never}
        patientUUID="patient-uuid"
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    const forbiddenError = Object.assign(new Error("Forbidden"), {
      status: 403,
    });
    act(() => {
      mockFormProcessorFactory.mock.calls
        .at(-1)?.[0]
        .onDependencyError(forbiddenError);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The existing clinical record could not be loaded",
    );
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent(/403|forbidden/i);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load data required by the form.",
    );
  });

  it("fails closed before rendering when the loaded patient identity differs", () => {
    mockUsePatientData.mockReturnValue({
      isLoadingPatient: false,
      patient: { id: "another-patient" },
      patientError: undefined,
    });

    render(<FormEngine formJson={{ uuid: "form-uuid" } as never} patientUUID="patient-uuid" />);

    expect(screen.getByRole("alert")).toHaveTextContent("The existing clinical record could not be loaded");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(mockFormProcessorFactory).not.toHaveBeenCalled();
  });
});
