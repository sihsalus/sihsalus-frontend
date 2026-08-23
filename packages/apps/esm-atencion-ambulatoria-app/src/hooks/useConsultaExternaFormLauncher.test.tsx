import { launchWorkspace2, openmrsFetch, showSnackbar } from "@openmrs/esm-framework";
import {
  launchStartVisitPrompt,
  usePatientChartStore,
  useVisitOrOfflineVisit,
} from "@openmrs/esm-patient-common-lib";
import { act, renderHook, waitFor } from "@testing-library/react";
import { patientFormEntryWorkspace } from "../utils/constants";
import { useConsultaExternaFormLauncher } from "./useConsultaExternaFormLauncher";

vi.mock("@openmrs/esm-patient-common-lib", async () => {
  const actual = await vi.importActual("@openmrs/esm-patient-common-lib");
  return {
    ...actual,
    launchStartVisitPrompt: vi.fn(),
    usePatientChartStore: vi.fn(),
    useVisitOrOfflineVisit: vi.fn(),
  };
});

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback: string) => fallback,
    }),
  };
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockLaunchStartVisitPrompt = vi.mocked(launchStartVisitPrompt);
const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);
const mockUsePatientChartStore = vi.mocked(usePatientChartStore);

const patientUuid = "patient-synthetic-uuid";
const visitUuid = "visit-synthetic-uuid";
const ambulatoryVisitTypeUuid = "b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09";
const encounterTypeUuid = "186c1e78-a99f-4cd0-86de-b8c4ee27a2b5";
const formIdentifier = "CE-ANAM-001-ANAMNESIS";
const formUuid = "0a6f1037-9f41-4d31-876a-1d43df62f99c";
const visitStartDatetime = "2026-08-23T14:00:00.000-05:00";

function matchingEncounter(uuid: string) {
  return {
    uuid,
    patient: { uuid: patientUuid },
    visit: { uuid: visitUuid },
    encounterType: { uuid: encounterTypeUuid },
    form: { uuid: formUuid },
  };
}

const activeVisit = {
  uuid: visitUuid,
  startDatetime: visitStartDatetime,
  stopDatetime: null,
  visitType: {
    uuid: ambulatoryVisitTypeUuid,
    display: "Atención Ambulatoria",
  },
  encounters: [],
};

function mockVisitState(overrides: Record<string, unknown> = {}) {
  mockUseVisitOrOfflineVisit.mockReturnValue({
    activeVisit,
    currentVisit: activeVisit,
    currentVisitIsRetrospective: false,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useVisitOrOfflineVisit>);
}

function mockPublishedFormResponse() {
  mockOpenmrsFetch.mockResolvedValueOnce({
    data: {
      results: [
        {
          uuid: formUuid,
          name: formIdentifier,
          display: "Anamnesis",
          published: true,
          retired: false,
          encounterType: { uuid: encounterTypeUuid },
        },
      ],
    },
  } as never);
}

function renderLauncher({
  entryMode = "one-per-visit",
  mutate = vi.fn(),
  configuredForm = formIdentifier,
}: {
  entryMode?: "one-per-visit" | "repeatable";
  mutate?: () => unknown;
  configuredForm?: string | null;
} = {}) {
  const hook = renderHook(() =>
    useConsultaExternaFormLauncher({
      patientUuid,
      formIdentifier: configuredForm,
      encounterTypeUuid,
      ambulatoryVisitTypeUuid,
      mutate,
      entryMode,
    }),
  );

  return { ...hook, mutate };
}

function getRequestedUrl(callIndex: number): URL {
  return new URL(
    String(mockOpenmrsFetch.mock.calls[callIndex][0]),
    "https://synthetic.test",
  );
}

describe("useConsultaExternaFormLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspace2.mockResolvedValue(true);
    mockUsePatientChartStore.mockReturnValue({
      patient: { id: patientUuid },
      patientUuid,
      visitContext: activeVisit,
      mutateVisitContext: vi.fn(),
    } as never);
    mockVisitState();
  });

  it("opens the existing start-visit prompt when no visit is active", () => {
    mockVisitState({ activeVisit: null, currentVisit: null });
    const { result } = renderLauncher();

    act(() => result.current());

    expect(mockLaunchStartVisitPrompt).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "a visit lookup error",
      overrides: { error: new Error("synthetic request failure") },
      expectedSubtitle:
        "The active outpatient visit could not be verified. Reload and try again.",
    },
    {
      name: "a visit lookup still loading",
      overrides: { isLoading: true },
      expectedSubtitle:
        "The active outpatient visit is still being verified. Please try again in a moment.",
    },
    {
      name: "an active visit of another type",
      overrides: {
        activeVisit: {
          ...activeVisit,
          visitType: { uuid: "emergency-visit", display: "Emergencia" },
        },
        currentVisit: {
          ...activeVisit,
          visitType: { uuid: "emergency-visit", display: "Emergencia" },
        },
      },
      expectedSubtitle:
        "An active Outpatient Care visit is required to record this information.",
    },
  ])(
    "fails closed with a translated message for $name",
    ({ overrides, expectedSubtitle }) => {
      mockVisitState(overrides);
      const { result } = renderLauncher();

      act(() => result.current());

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "error",
          subtitle: expectedSubtitle,
        }),
      );
      expect(mockOpenmrsFetch).not.toHaveBeenCalled();
      expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    },
  );

  it("creates the sole-per-visit form when no matching encounter exists and attaches the verified visit", async () => {
    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never);
    const { result, mutate } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledOnce(),
    );

    const formQuery = getRequestedUrl(0);
    expect(formQuery.pathname).toContain("/form");
    expect(formQuery.searchParams.get("q")).toBe(formIdentifier);

    const encounterQuery = getRequestedUrl(1);
    expect(encounterQuery.searchParams.get("patient")).toBe(patientUuid);
    expect(encounterQuery.searchParams.get("visit")).toBe(visitUuid);
    expect(encounterQuery.searchParams.get("encounterType")).toBe(
      encounterTypeUuid,
    );
    expect(encounterQuery.searchParams.has("form")).toBe(false);
    expect(encounterQuery.searchParams.get("limit")).toBe("100");

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      patientFormEntryWorkspace,
      {
        workspaceTitle: "Anamnesis",
        mutateForm: expect.any(Function),
        formInfo: {
          patientUuid,
          formUuid,
          encounterUuid: undefined,
          visitUuid,
          visitTypeUuid: ambulatoryVisitTypeUuid,
          visitStartDatetime,
          visitStopDatetime: undefined,
        },
      },
      null,
      expect.objectContaining({ patientUuid, visitContext: activeVisit }),
    );

    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as {
      mutateForm: () => void;
    };
    act(() => workspaceProps.mutateForm());
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("edits the one matching Anamnesis or SOAP encounter instead of creating a duplicate", async () => {
    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [matchingEncounter("existing-encounter")] },
    } as never);
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
        patientFormEntryWorkspace,
        expect.objectContaining({
          formInfo: expect.objectContaining({
            encounterUuid: "existing-encounter",
            visitUuid,
          }),
        }),
        null,
        expect.objectContaining({ patientUuid }),
      ),
    );
  });

  it("blocks ambiguous duplicate encounters without silently choosing one", async () => {
    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          matchingEncounter("encounter-one"),
          matchingEncounter("encounter-two"),
        ],
      },
    } as never);
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle:
            "More than one record of this form exists in the active visit. Resolve the duplicate before editing.",
        }),
      ),
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it("rejects an encounter whose returned clinical identity does not match every requested filter", async () => {
    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            ...matchingEncounter("mismatched-encounter"),
            visit: { uuid: "another-visit" },
          },
        ],
      },
    } as never);
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle:
            "The existing clinical record could not be verified. Reload and try again.",
        }),
      ),
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it("fails closed when the form or existing encounter cannot be verified", async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(
      new Error("synthetic backend failure"),
    );
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle:
            "The existing clinical record could not be verified. Reload and try again.",
        }),
      ),
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it("creates each referral as a repeatable encounter but still attaches it to the visit", async () => {
    mockPublishedFormResponse();
    const { result } = renderLauncher({ entryMode: "repeatable" });

    act(() => result.current());

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledOnce(),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      patientFormEntryWorkspace,
      expect.objectContaining({
        formInfo: expect.objectContaining({
          encounterUuid: undefined,
          visitUuid,
          visitTypeUuid: ambulatoryVisitTypeUuid,
        }),
      }),
      null,
      expect.objectContaining({ patientUuid }),
    );
  });

  it("paginates supported filters and selects only the exact form client-side", async () => {
    mockPublishedFormResponse();
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [{ ...matchingEncounter("other-form"), form: { uuid: "different-form" } }],
          links: [{ rel: "next" }],
        },
      } as never)
      .mockResolvedValueOnce({ data: { results: [matchingEncounter("exact-form")], links: [] } } as never);
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    expect(getRequestedUrl(1).searchParams.has("form")).toBe(false);
    expect(getRequestedUrl(2).searchParams.get("startIndex")).toBe("1");
    expect(mockLaunchWorkspace2.mock.calls[0][1]).toEqual(
      expect.objectContaining({ formInfo: expect.objectContaining({ encounterUuid: "exact-form" }) }),
    );
  });

  it("releases the click guard when the workspace launch is denied", async () => {
    mockLaunchWorkspace2.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never);
    const { result } = renderLauncher();
    act(() => result.current());
    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());

    mockPublishedFormResponse();
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never);
    act(() => result.current());

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledTimes(2));
  });

  it("suppresses concurrent clicks while resolving and while the workspace remains open", async () => {
    let resolveFormRequest: (value: unknown) => void = () => undefined;
    mockOpenmrsFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFormRequest = resolve;
        }) as never,
    );
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never);
    const { result } = renderLauncher();

    act(() => {
      result.current();
      result.current();
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();

    act(() => {
      resolveFormRequest({
        data: {
          results: [
            {
              uuid: formUuid,
              name: formIdentifier,
              display: "Anamnesis",
              published: true,
              retired: false,
              encounterType: { uuid: encounterTypeUuid },
            },
          ],
        },
      });
    });

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledOnce(),
    );
    act(() => result.current());
    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
  });
});
