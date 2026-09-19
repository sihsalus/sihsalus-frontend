import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseForm } from "./case-form.component";
import { saveCase } from "./offline";
import { catalogue, request } from "./test-fixtures";
import en from "../translations/en.json";
const connection = vi.hoisted(() => ({ online: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      let value: unknown = en;
      for (const part of key.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return typeof value === "string" ? value : (fallback ?? key);
    },
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  getUserFacingErrorMessage: (
    error: { code?: string },
    fallback: string,
    options?: { codeMessages?: Record<string, string> },
  ) => options?.codeMessages?.[error.code ?? ""] ?? fallback,
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
  useConnectivity: () => connection.online,
  useSession: () => ({
    authenticated: true,
    user: { uuid: "user", person: { uuid: "person" } },
  }),
}));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  read: vi.fn(async () => ({
    resourceType: "Patient",
    id: "patient",
    name: [{ text: "Synthetic Patient" }],
    gender: "female",
    birthDate: "2000-01-01",
  })),
  fhirSearch: vi.fn(async (resource: string) =>
    resource === "Patient"
      ? [{ resourceType: "Patient", id: "patient", name: [{ text: "Synthetic Patient" }] }]
      : resource === "Encounter"
      ? [
          {
            resourceType: "Encounter",
            id: "source",
            subject: { reference: "Patient/patient" },
            period: { start: "2026-01-20" },
            status: "finished",
            type: [{ coding: [{ code: "surveillance-type" }], text: "Metaxenicas" }],
          },
          {
            resourceType: "Encounter",
            id: "other-care",
            subject: { reference: "Patient/patient" },
            period: { start: "2026-01-20" },
            status: "finished",
            type: [{ coding: [{ code: "other-type" }], text: "Other care" }],
          },
        ]
      : [],
  ),
  references: vi.fn(async (resource: string) =>
    resource === "provider"
      ? [
          {
            uuid: "provider",
            display: "Synthetic professional",
            person: { uuid: "person" },
          },
        ]
      : [{ uuid: "location", display: "Synthetic locality" }],
  ),
}));
vi.mock("./offline", () => ({ saveCase: vi.fn() }));
describe("case registration screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.online = true;
  });
  it("does not advance when the patient context is missing", async () => {
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("Complete the highlighted fields"),
    ).toBeInTheDocument();
    expect(saveCase).not.toHaveBeenCalled();
  });
  it("offers the existing metaxenicas encounter and excludes other care", async () => {
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "Synthetic" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Synthetic Patient/);
    fireEvent.change(screen.getByLabelText("Patient"), { target: { value: "patient" } });
    await waitFor(() => expect(screen.getByText(/Metaxenicas/)).toBeInTheDocument());
    expect(screen.queryByText(/Other care/)).not.toBeInTheDocument();
  });
  it("registers within three steps and distinguishes offline persistence", async () => {
    vi.mocked(saveCase).mockResolvedValue({ queued: true });
    render(
      <CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />,
    );
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await screen.findByText("Pending synchronization");
    expect(saveCase).toHaveBeenCalledWith(request, "user", true);
    expect(
      screen.queryByText("Case registered on the server"),
    ).not.toBeInTheDocument();
  });
  it("preserves the active form when connectivity changes", async () => {
    const props = { catalogue, initial: request, onSaved: vi.fn() };
    const view = render(<CaseForm {...props} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    connection.online = false;
    view.rerender(<CaseForm {...props} />);
    expect(screen.getByLabelText("Symptom onset date")).toHaveValue(
      "2026-01-19",
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
});
