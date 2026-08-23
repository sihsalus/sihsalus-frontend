import {
  getDefaultsFromConfigSchema,
  UserHasAccess,
  useConfig,
} from "@openmrs/esm-framework";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { configSchema } from "../config-schema";
import { useConsultaExternaVisitNoteLauncher } from "../hooks/useConsultaExternaVisitNoteLauncher";
import { useDiagnosisHistory } from "../hooks/useDiagnosisHistory";
import {
  consultaExternaEditPrivilege,
  visitNotesEditPrivilege,
} from "../utils/constants";
import DiagnosticoClasificado from "./diagnostico-clasificado.component";

vi.mock("../hooks/useDiagnosisHistory", () => ({
  useDiagnosisHistory: vi.fn(),
}));

vi.mock("../hooks/useConsultaExternaVisitNoteLauncher", () => ({
  useConsultaExternaVisitNoteLauncher: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseDiagnosisHistory = vi.mocked(useDiagnosisHistory);
const mockUseConsultaExternaVisitNoteLauncher = vi.mocked(
  useConsultaExternaVisitNoteLauncher,
);
const mockLaunchVisitNote = vi.fn();

describe("DiagnosticoClasificado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserHasAccess).mockImplementation(
      ({ children }: { children?: ReactNode }) => children,
    );
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseConsultaExternaVisitNoteLauncher.mockReturnValue(
      mockLaunchVisitNote,
    );
    mockUseDiagnosisHistory.mockReturnValue({
      diagnoses: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
    } as unknown as ReturnType<typeof useDiagnosisHistory>);
  });

  it("opens the canonical visit summary and requires both editing privileges", async () => {
    const user = userEvent.setup();

    render(<DiagnosticoClasificado patientUuid="patient-uuid" />);
    await user.click(
      screen.getByRole("button", {
        name: /(?:record|registrar) diagn[oó]stic/i,
      }),
    );

    expect(mockUseConsultaExternaVisitNoteLauncher).toHaveBeenCalledWith({
      patientUuid: "patient-uuid",
      ambulatoryVisitTypeUuid:
        getDefaultsFromConfigSchema(configSchema).visitTypes.ambulatory,
      mutate: expect.any(Function),
    });
    expect(mockLaunchVisitNote).toHaveBeenCalledOnce();
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
