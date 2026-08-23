import {
  type FetchResponse,
  openmrsFetch,
  showSnackbar,
  useVisit,
} from "@openmrs/esm-framework";
import {
  fetchVisitInsurance,
  getSisFinancingState,
  launchPatientWorkspace,
} from "@openmrs/esm-patient-common-lib";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockCurrentVisit } from "test-utils";

import EndVisitDialog from "./end-visit-dialog.component";

vi.mock("@openmrs/esm-patient-common-lib", async () => ({
  ...(await vi.importActual("@openmrs/esm-patient-common-lib")),
  fetchVisitInsurance: vi.fn(),
  getSisFinancingState: vi.fn(),
  launchPatientWorkspace: vi.fn(),
}));

const mockCloseModal = vi.fn();
const mockFetchVisitInsurance = vi.mocked(fetchVisitInsurance);
const mockGetSisFinancingState = vi.mocked(getSisFinancingState);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockMutate = vi.fn();
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseVisit = vi.mocked(useVisit);

describe("End visit dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: "sis-concept",
      insuranceNumber: "SIS-123",
      accreditationStatusUuid: "vigente-concept",
      accreditationCheckedAt: "2026-08-17",
    });
    mockGetSisFinancingState.mockReturnValue("active");
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });
  });

  test("shows a neutral end-visit action while eligibility is verified on submit", () => {
    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^close$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /close visit/i }),
    ).not.toBeInTheDocument();
  });

  test("ends the visit and generates FUA when required visit summary fields are present", async () => {
    const user = userEvent.setup();
    let resolveGenerateFua!: (value: FetchResponse) => void;
    const generateFuaPromise = new Promise<FetchResponse>((resolve) => {
      resolveGenerateFua = resolve;
    });

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              diagnoses: [{ rank: 1, voided: false }],
              obs: [{ formFieldPath: "codigo-prestacional", value: "056" }],
            },
          ],
        },
      } as FetchResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          visitType: {
            display: "Facility Visit",
          },
        },
      } as FetchResponse)
      .mockReturnValueOnce(generateFuaPromise);

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /are you sure you want to end this active visit?/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /you can add additional encounters to this visit in the visit summary/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        2,
        "/ws/rest/v1/clinicalvisitclosure",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            visitUuid: mockCurrentVisit.uuid,
            stopDatetime: expect.any(String),
          }),
        }),
      ),
    );
    expect(screen.getAllByText(/finalizando consulta/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();

    await act(async () => {
      resolveGenerateFua({ data: {} } as FetchResponse);
      await generateFuaPromise;
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: "Visit ended and FUA Generated",
      kind: "success",
      title: "Visit ended and FUA Generated",
    });
  });

  test("opens visit summary and does not end the visit when required fields are missing", async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            diagnoses: [],
            obs: [{ formFieldPath: "codigo-prestacional", value: "" }],
          },
        ],
      },
    } as FetchResponse);

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() =>
      expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(
        "visit-notes-form-workspace",
        {
          openedFrom: "end-visit-dialog",
        },
      ),
    );
    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: "Missing required visit summary data",
      kind: "warning",
      isLowContrast: true,
      subtitle:
        "Complete Primary diagnosis, Codigo Prestacional in Resumen de consulta before finalizing the visit.",
    });
  });

  test("checks every encounter page before deciding required summary data is missing", async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 50 }, () => ({
      diagnoses: [],
      obs: [],
    }));

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: { results: firstPage, links: [{ rel: "next" }] },
      } as FetchResponse)
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              diagnoses: [{ rank: 1, voided: false }],
              obs: [{ formFieldPath: "codigo-prestacional", value: "056" }],
            },
          ],
          links: [],
        },
      } as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: {} } as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: {} } as FetchResponse);

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4));
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain("startIndex=0");
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain("startIndex=50");
    expect(mockOpenmrsFetch.mock.calls[2][0]).toBe(
      "/ws/rest/v1/clinicalvisitclosure",
    );
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
  });

  test("ends a non-SIS visit without validating or generating a FUA", async () => {
    const user = userEvent.setup();
    mockGetSisFinancingState.mockReturnValue("notApplicable");
    mockOpenmrsFetch.mockResolvedValueOnce({
      status: 200,
      data: {},
    } as FetchResponse);

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        "/ws/rest/v1/clinicalvisitclosure",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/ws/module/fua"),
      expect.anything(),
    );
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: "success",
      subtitle: "Visit ended",
      title: "Visit ended",
    });
  });

  test("keeps the visit active and reports a closure failure separately from FUA generation", async () => {
    const user = userEvent.setup();

    const error = {
      message: "Internal error message",
      response: {
        status: 500,
        statusText: "Internal server error",
      },
    };

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            diagnoses: [{ rank: 1, voided: false }],
            obs: [{ formFieldPath: "codigo-prestacional", value: "056" }],
          },
        ],
      },
    } as FetchResponse);
    mockOpenmrsFetch.mockRejectedValueOnce(error);

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );

    expect(
      screen.getByText(
        /you can add additional encounters to this visit in the visit summary/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        2,
        "/ws/rest/v1/clinicalvisitclosure",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            visitUuid: mockCurrentVisit.uuid,
            stopDatetime: expect.any(String),
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        subtitle:
          "The visit was not ended. Review the connection and try again.",
        kind: "error",
        title: "Error ending visit",
        isLowContrast: false,
      }),
    );
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/ws/module/fua"),
      expect.anything(),
    );
  });

  test("reports FUA as pending when generation fails after the visit was closed", async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              diagnoses: [{ rank: 1, voided: false }],
              obs: [{ formFieldPath: "codigo-prestacional", value: "056" }],
            },
          ],
        },
      } as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: {} } as FetchResponse)
      .mockRejectedValueOnce(new Error("FUA unavailable"));

    render(
      <EndVisitDialog
        patientUuid="some-patient-uuid"
        closeModal={mockCloseModal}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /finalizar consulta$/i }),
    );

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        subtitle:
          "The visit was ended, but the FUA could not be generated. Retry it from FUA management.",
        kind: "warning",
        title: "Visit ended; FUA pending",
        isLowContrast: true,
      }),
    );
    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockMutate).toHaveBeenCalled();
  });
});
