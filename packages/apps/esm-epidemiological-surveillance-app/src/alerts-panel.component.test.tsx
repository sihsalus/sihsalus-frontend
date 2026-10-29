import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AlertAccess,
  AlertNotifications,
  AlertsPanel,
  alertInformation,
} from "./alerts-panel.component";
import { attendAlert, getAlerts } from "./api";
import { showToast } from "@openmrs/esm-framework";
import type { SurveillanceAlert } from "./types";
import es from "../translations/es.json";
import en from "../translations/en.json";

const state = vi.hoisted(() => ({ allowed: true }));
vi.mock("./api", () => ({
  apiBase: "/surveillance",
  getAlerts: vi.fn(),
  attendAlert: vi.fn(),
}));
vi.mock("@openmrs/esm-framework", () => ({
  showToast: vi.fn(),
  makeUrl: (path: string) => `/openmrs${path}`,
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
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

it.each(["ACTIVE", "RESIDUAL", "ELIMINATED", "UNCLASSIFIED"] as const)(
  "translates persisted focus %s using the selected language without changing the evidence",
  (focus) => {
    const stored = {
      ...alert,
      type: "OUTBREAK" as const,
      additionalInformation: `Semana desde 2025-10-05; origen: AUTOCTONO; foco previo: ${focus}; casos: 1; superar: 0`,
    };
    for (const translations of [es, en]) {
      expect(
        alertInformation(stored, (key) => {
          if (key === "geo.origins.AUTOCTONO")
            return translations.geo.origins.AUTOCTONO;
          expect(key).toBe(`geo.classes.${focus}`);
          return translations.geo.classes[focus];
        }),
      ).toBe(
        `Semana desde 2025-10-05; origen: ${translations.geo.origins.AUTOCTONO}; foco previo: ${translations.geo.classes[focus]}; casos: 1; superar: 0`,
      );
    }
    expect(stored.additionalInformation).toContain(`foco previo: ${focus};`);
  },
);

it.each(Object.keys(es.geo.origins) as Array<keyof typeof es.geo.origins>)(
  "translates persisted origin %s in Spanish and English",
  (origin) => {
    for (const translations of [es, en]) {
      const stored = {
        ...alert,
        type: "OUTBREAK" as const,
        additionalInformation: `origen: ${origin}; casos: 1`,
      };
      expect(
        alertInformation(stored, (key) => {
          expect(key).toBe(`geo.origins.${origin}`);
          return translations.geo.origins[origin];
        }),
      ).toBe(`origen: ${translations.geo.origins[origin]}; casos: 1`);
      expect(stored.additionalInformation).toBe(`origen: ${origin}; casos: 1`);
    }
  },
);

it("preserves missing, unknown and already translated alert details", () => {
  const translate = vi.fn();
  for (const information of [
    null,
    "foco previo: FUTURE; casos: 1",
    "foco previo: Eliminado; casos: 1",
    "origen: FUTURE; casos: 1",
    "origen: Autóctono; casos: 1",
  ]) {
    expect(
      alertInformation(
        { ...alert, type: "OUTBREAK", additionalInformation: information },
        translate,
      ),
    ).toBe(information ?? "—");
  }
  expect(alertInformation(alert, translate)).toBe(alert.additionalInformation);
  expect(translate).not.toHaveBeenCalled();
});

it("renders the translated focus in the inbox for stored outbreak alerts", async () => {
  vi.mocked(getAlerts).mockResolvedValue([
    {
      ...alert,
      type: "OUTBREAK",
      additionalInformation:
        "Semana desde 2025-10-05; origen: AUTOCTONO; foco previo: ELIMINATED; casos: 1",
    },
  ]);
  render(<AlertsPanel />);
  expect(
    await screen.findByText(
      "Semana desde 2025-10-05; origen: geo.origins.AUTOCTONO; foco previo: geo.classes.ELIMINATED; casos: 1",
    ),
  ).toBeInTheDocument();
});
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

it("paginates alerts and attends the selected alert on the second page", async () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({
    ...alert,
    uuid: `alert-${index + 1}`,
    eventName: `Event ${index + 1}`,
  }));
  vi.mocked(getAlerts).mockResolvedValue(rows);
  render(<AlertsPanel />);
  await screen.findByText("Event 1");
  expect(screen.queryByText("Event 11")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Event 11")).toBeInTheDocument();
  expect(screen.queryByText("Event 1")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  vi.mocked(getAlerts).mockResolvedValue(rows.slice(0, 10));
  fireEvent.click(screen.getByRole("button", { name: "alertInbox.attend" }));
  await waitFor(() => expect(attendAlert).toHaveBeenCalledWith("alert-11"));
  await screen.findByText("Event 1");
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
});

it("uses the shared page sizes and resets the page after filters and refresh", async () => {
  vi.mocked(getAlerts).mockResolvedValue(
    Array.from({ length: 51 }, (_, index) => ({
      ...alert,
      uuid: `alert-${index + 1}`,
      eventName: `Event ${index + 1}`,
    })),
  );
  render(<AlertsPanel />);
  await screen.findByText("Event 1");
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  fireEvent.change(screen.getByLabelText("Filas por página:"), {
    target: { value: "20" },
  });
  expect(screen.getByText("Event 1")).toBeInTheDocument();
  expect(screen.getByText("Event 20")).toBeInTheDocument();
  expect(screen.queryByText("Event 21")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filas por página:"), {
    target: { value: "50" },
  });
  expect(screen.getByText("Event 50")).toBeInTheDocument();
  expect(screen.queryByText("Event 51")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  fireEvent.change(screen.getByLabelText("alertInbox.status"), {
    target: { value: "PENDING" },
  });
  await screen.findByText("Event 1");
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  fireEvent.click(screen.getByRole("button", { name: "alertInbox.refresh" }));
  await screen.findByText("Event 1");
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
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
    constructor(url: string, options: EventSourceInit) {
      expect(url).toBe("/openmrs/surveillance/alerts/stream");
      expect(options.withCredentials).toBe(true);
    }
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

it("recovers new alerts without stream messages and stops polling after unmount", async () => {
  vi.useFakeTimers();
  const close = vi.fn();
  vi.stubGlobal(
    "EventSource",
    class {
      close = close;
    },
  );
  vi.mocked(getAlerts)
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("offline"));
  const view = render(<AlertNotifications />);
  await act(async () => {});
  expect(showToast).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(showToast).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(showToast).toHaveBeenCalledTimes(1);
  view.unmount();
  const calls = vi.mocked(getAlerts).mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(getAlerts).toHaveBeenCalledTimes(calls);
  expect(close).toHaveBeenCalledTimes(1);
});

it("recovers on focus even when EventSource cannot be constructed", async () => {
  vi.stubGlobal(
    "EventSource",
    class {
      constructor() {
        throw new Error("unsupported");
      }
    },
  );
  vi.mocked(getAlerts).mockResolvedValueOnce([]);
  const view = render(<AlertNotifications />);
  await act(async () => {});
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
  view.unmount();
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


it.each(["IMMEDIATE", "OUTBREAK"] as const)("shows the original registering professional for %s", async (type) => {
  vi.mocked(getAlerts).mockResolvedValue([{ ...alert, type, registeredBy: "Ana Registro" }]);
  render(<AlertsPanel />);
  expect(await screen.findByText("Ana Registro")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "alertInbox.registeredBy" })).toBeInTheDocument();
  expect(es.alertInbox.reasons.IMMEDIATE_EVENT).toBe("Evento notificable");
});
