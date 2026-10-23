import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  AlertAccess,
  AlertNotifications,
  AlertsPanel,
} from "./alerts-panel.component";
import { attendAlert, getAlerts } from "./api";
import { showToast } from "@openmrs/esm-framework";
import type { SurveillanceAlert } from "./types";

const state = vi.hoisted(() => ({ allowed: true }));
vi.mock("./api", () => ({
  apiBase: "/surveillance",
  getAlerts: vi.fn(),
  attendAlert: vi.fn(),
}));
vi.mock("@openmrs/esm-framework", () => ({ showToast: vi.fn() }));
vi.mock("@sihsalus/esm-rbac", () => ({
  RequirePrivilege: ({ children }: { children: React.ReactNode }) =>
    state.allowed ? children : null,
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
const alert: SurveillanceAlert = {
  uuid: "alert-1",
  type: "IMMEDIATE",
  reason: "STATUS_CHANGED",
  caseUuid: "case-1",
  patientDisplay: "Paciente Sint?tico",
  encounterDate: "2026-10-20T10:00:00Z",
  diagnosisDisplay: "Diagn?stico sint?tico",
  diagnosisIcd10: "A90",
  eventUuid: "event-1",
  eventName: "Synthetic event",
  center: "Synthetic center",
  generatedAt: "2026-10-22T10:00:00Z",
  additionalInformation: "PROBABLE → CONFIRMADO",
  status: "PENDING",
  attendedAt: null,
  attendedBy: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  vi.mocked(getAlerts).mockResolvedValue([alert]);
  vi.mocked(attendAlert).mockResolvedValue({ ...alert, status: "ATTENDED" });
});
it("shows full data and filters by type, reason and status", async () => {
  render(<AlertsPanel />);
  expect(await screen.findByText("Synthetic event")).toBeInTheDocument();
  expect(screen.getByText("PROBABLE → CONFIRMADO")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("alertInbox.type"), {
    target: { value: "IMMEDIATE" },
  });
  fireEvent.change(screen.getByLabelText("alertInbox.reason"), {
    target: { value: "STATUS_CHANGED" },
  });
  fireEvent.change(screen.getByLabelText("alertInbox.status"), {
    target: { value: "PENDING" },
  });
  await waitFor(() =>
    expect(getAlerts).toHaveBeenLastCalledWith(
      { type: "IMMEDIATE", reason: "STATUS_CHANGED", status: "PENDING" },
      expect.any(AbortSignal),
    ),
  );
});
it("marks an alert attended only after confirmed persistence", async () => {
  render(<AlertsPanel />);
  fireEvent.click(await screen.findByText("alertInbox.attend"));
  await waitFor(() => expect(attendAlert).toHaveBeenCalledWith("alert-1"));
  expect(
    await screen.findByText("alertInbox.attendedSuccess"),
  ).toBeInTheDocument();
});
it("shows safe retrieval errors and supports retry", async () => {
  vi.mocked(getAlerts).mockRejectedValueOnce(new Error("private failure"));
  render(<AlertsPanel />);
  expect(await screen.findByText("Safe error")).toBeInTheDocument();
  expect(screen.queryByText("private failure")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("alertInbox.refresh"));
  expect(await screen.findByText("Synthetic event")).toBeInTheDocument();
});
it("does not load the inbox when access is denied", () => {
  state.allowed = false;
  render(
    <AlertAccess>
      <AlertsPanel />
    </AlertAccess>,
  );
  expect(getAlerts).not.toHaveBeenCalled();
});
it("shows committed alerts once across save and stream signals and closes the stream", async () => {
  const close = vi.fn();
  class Stream {
    onmessage: (() => void) | null = null;
    close = close;
  }
  vi.stubGlobal("EventSource", Stream);
  const view = render(<AlertNotifications />);
  await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
  act(() => {
    window.dispatchEvent(
      new CustomEvent("surveillance-alerts-generated", { detail: [alert] }),
    );
  });
  expect(showToast).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(close).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it("does not show a case for outbreak alerts", async () => {
  vi.mocked(getAlerts).mockResolvedValue([{ ...alert, type: "OUTBREAK" }]);
  render(<AlertsPanel />);
  await screen.findByText("Synthetic event");
  expect(screen.queryByText(/Paciente Sint?tico/)).not.toBeInTheDocument();
  expect(screen.queryByText("case-1")).not.toBeInTheDocument();
});

it("uses a single em dash when case details are unavailable", async () => {
  vi.mocked(getAlerts).mockResolvedValue([
    {
      ...alert,
      patientDisplay: null,
      encounterDate: null,
      diagnosisDisplay: null,
      diagnosisIcd10: null,
    },
  ]);
  render(<AlertsPanel />);
  const event = await screen.findByText("Synthetic event");
  expect(event.closest("tr")?.children[1].textContent).toBe("\u2014");
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
    "Filters",
  );
});
