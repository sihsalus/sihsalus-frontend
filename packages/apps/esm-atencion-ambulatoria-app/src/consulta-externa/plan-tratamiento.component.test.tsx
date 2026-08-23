import {
  getDefaultsFromConfigSchema,
  UserHasAccess,
  useConfig,
  userHasAccess,
} from "@openmrs/esm-framework";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { configSchema } from "../config-schema";
import { useConsultaExternaVisitNoteLauncher } from "../hooks/useConsultaExternaVisitNoteLauncher";
import { useTreatmentPlan } from "../hooks/useTreatmentPlan";
import {
  consultaExternaEditPrivilege,
  visitNotesEditPrivilege,
} from "../utils/constants";
import PlanTratamiento from "./plan-tratamiento.component";

vi.mock("../hooks/useTreatmentPlan", () => ({
  useTreatmentPlan: vi.fn(),
}));

vi.mock("../hooks/useConsultaExternaVisitNoteLauncher", () => ({
  useConsultaExternaVisitNoteLauncher: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseConsultaExternaVisitNoteLauncher = vi.mocked(
  useConsultaExternaVisitNoteLauncher,
);
const mockUseTreatmentPlan = vi.mocked(useTreatmentPlan);
const mockLaunchVisitNote = vi.fn();

describe("PlanTratamiento — order basket action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserHasAccess).mockImplementation(
      ({ children }: { children?: ReactNode }) => children,
    );
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseConsultaExternaVisitNoteLauncher.mockReturnValue(
      mockLaunchVisitNote,
    );
    mockUseTreatmentPlan.mockReturnValue({
      treatmentPlans: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
    } as unknown as ReturnType<typeof useTreatmentPlan>);
  });

  it("offers the prescribe action to a user who can edit orders", () => {
    mockUserHasAccess.mockReturnValue(true);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(
      screen.getByRole("button", { name: /prescribir medicamentos/i }),
    ).toBeInTheDocument();
    expect(mockUserHasAccess.mock.calls[0][0]).toBe(
      "app:hoja.clinica.ordenes.editar",
    );
  });

  it("hides the prescribe action without the ordering privilege, so no visit is started for a launch that would fail", () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(
      screen.queryByRole("button", { name: /prescribir medicamentos/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the canonical visit summary for plan data and keeps the order basket as a separate action", async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockReturnValue(true);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    await user.click(
      screen.getByRole("button", { name: /(?:record|registrar) plan/i }),
    );

    expect(mockUseConsultaExternaVisitNoteLauncher).toHaveBeenCalledWith({
      patientUuid: "patient-uuid",
      ambulatoryVisitTypeUuid:
        getDefaultsFromConfigSchema(configSchema).visitTypes.ambulatory,
      mutate: expect.any(Function),
    });
    expect(mockLaunchVisitNote).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: /prescribir medicamentos/i }),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(UserHasAccess)
        .mock.calls.some(
          ([props]) =>
            JSON.stringify(props.privilege) ===
            JSON.stringify([
              consultaExternaEditPrivilege,
              visitNotesEditPrivilege,
            ]),
        ),
    ).toBe(true);
  });
});
