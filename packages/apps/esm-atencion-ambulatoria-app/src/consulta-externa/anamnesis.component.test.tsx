import { useConfig } from "@openmrs/esm-framework";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAnamnesis } from "../hooks/useAnamnesis";
import { useConsultaExternaFormLauncher } from "../hooks/useConsultaExternaFormLauncher";
import Anamnesis from "./anamnesis.component";

vi.mock("../hooks/useAnamnesis", () => ({
  useAnamnesis: vi.fn(),
}));

vi.mock("../hooks/useConsultaExternaFormLauncher", () => {
  return {
    useConsultaExternaFormLauncher: vi.fn(),
  };
});

const mockUseAnamnesis = vi.mocked(useAnamnesis);
const mockUseConsultaExternaFormLauncher = vi.mocked(
  useConsultaExternaFormLauncher,
);
const mockUseConfig = vi.mocked(useConfig);
const mockLaunchForm = vi.fn();
const pagination = {
  currentPage: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
};

describe("Anamnesis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConsultaExternaFormLauncher.mockReturnValue(mockLaunchForm);
    mockUseConfig.mockReturnValue({
      encounterTypes: {
        externalConsultation: "external-consultation",
      },
      formsList: {
        anamnesisForm: "CE-ANAM-001-ANAMNESIS",
        consultaExternaForm: "CE-001-CONSULTA EXTERNA",
      },
      visitTypes: {
        ambulatory: "ambulatory-visit",
      },
      concepts: {
        chiefComplaintUuid: "chief",
        anamnesisUuid: "anamnesis",
      },
    });
  });

  it("renders the standard empty state and launches anamnesis registration", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseAnamnesis.mockReturnValue({
      anamnesisEntries: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
    });

    render(<Anamnesis patientUuid="patient-uuid" />);

    expect(screen.getByText("Historial de Anamnesis")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /(?:Record|Registrar) anamnesis/i }),
    );

    expect(mockUseConsultaExternaFormLauncher).toHaveBeenCalledWith({
      patientUuid: "patient-uuid",
      formIdentifier: "CE-ANAM-001-ANAMNESIS",
      encounterTypeUuid: "external-consultation",
      ambulatoryVisitTypeUuid: "ambulatory-visit",
      mutate,
      entryMode: "one-per-visit",
    });
    expect(mockLaunchForm).toHaveBeenCalledOnce();
  });

  it("renders anamnesis data and launches the split anamnesis form", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseAnamnesis.mockReturnValue({
      anamnesisEntries: [
        {
          encounterUuid: "encounter-uuid",
          encounterDatetime: "2026-04-27T10:00:00.000Z",
          provider: "Dra. Perez",
          chiefComplaint: "Dolor abdominal",
          illnessDuration: "3 dias",
          onsetType: "Insidioso",
          course: "Progresivo",
          narrative: "Dolor posterior a ingesta de alimentos.",
          biologicalFunctionsSummary: null,
          biologicalFunctions: {
            appetite: "Disminuido",
            thirst: "Conservada",
            sleep: "Alterado",
            mood: "Ansioso",
            urine: "Normal",
            bowelMovements: "Disminuidas",
          },
        },
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
    });

    render(<Anamnesis patientUuid="patient-uuid" />);

    expect(screen.getByText("Dolor abdominal")).toBeInTheDocument();
    expect(
      screen.getByText("Dolor posterior a ingesta de alimentos."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Disminuido/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dra\. Perez/ }),
    ).toHaveTextContent(/\d{1,2}:\d{2}/);

    await user.click(
      screen.getByRole("button", { name: "Registrar Anamnesis" }),
    );

    expect(mockLaunchForm).toHaveBeenCalledOnce();
  });
});
