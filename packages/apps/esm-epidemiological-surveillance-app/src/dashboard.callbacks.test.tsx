import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Dashboard from "./dashboard.component";
import { getCatalogue } from "./api";
import { catalogue } from "./test-fixtures";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@openmrs/esm-framework", () => ({
  useSession: () => ({ authenticated: true, user: { uuid: "user" } }),
}));
vi.mock("@sihsalus/esm-rbac", () => ({
  RequirePrivilege: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./api", () => ({ getCatalogue: vi.fn() }));
vi.mock("./alerts-panel.component", () => ({
  AlertAccess: ({ children }: { children: ReactNode }) => children,
  AlertNotifications: () => null,
  AlertsPanel: () => <div>Alerts content</div>,
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
vi.mock("./case-form.component", () => ({ CaseForm: () => <div>Case form content</div> }));
vi.mock("./reload-surveillance", () => ({ reloadSurveillancePage: vi.fn() }));
vi.mock("./cases-panel.component", () => ({
  CasesPanel: ({ onNewCase }: { onNewCase: () => void }) => (
    <button type="button" onClick={onNewCase}>
      New case
    </button>
  ),
}));
vi.mock("./notification-settings.component", () => ({ NotificationSettings: ({ onSaved }: { onSaved: () => void }) => (
    <button type="button" onClick={onSaved}>Notification saved</button>
  ) }));
vi.mock("./endemic-settings.component", () => ({ EndemicSettings: ({ onSaved }: { onSaved: () => void }) => (
    <button type="button" onClick={onSaved}>Endemic saved</button>
  ) }));
vi.mock("./geographic-settings.component", () => ({ GeographicSettings: ({ onSaved }: { onSaved: () => void }) => (
    <button type="button" onClick={onSaved}>Geographic saved</button>
  ) }));
vi.mock("./age-groups.component", () => ({ AgeGroupsPanel: () => <div>Age configuration</div> }));
vi.mock("./outbreak-rules.component", () => ({ OutbreakRulesSettings: () => <div>Outbreak configuration</div> }));
vi.mock("./demographic-panel.component", () => ({ DemographicPanel: () => <div>Demographic content</div> }));
vi.mock("./indicators-panel.component", () => ({ IndicatorsPanel: () => <div>Indicator content</div> }));
vi.mock("./geographic-panel.component", () => ({ GeographicPanel: () => <div>Geographic content</div> }));
vi.mock("./events-panel.component", () => ({ EventsPanel: () => <div>Events content</div> }));
vi.mock("./report-panel.component", () => ({ ReportPanel: () => <div>Report content</div> }));
vi.mock("./weekly-records.component", () => ({ WeeklyRecordsPanel: () => <div>Weekly records content</div> }));
vi.mock("./investigation-forms.component", () => ({
  InvestigationFormsPanel: () => <div>Investigation forms content</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("retries a failed catalogue and handles the new-case modal and configuration saves", async () => {
  vi.mocked(getCatalogue).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(catalogue);
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Safe error");
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  fireEvent.click(await screen.findByRole("button", { name: "New case" }));
  expect(screen.getByText("Case form content")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /^close$/i })[0]);
  fireEvent.click(screen.getByRole("tab", { name: "configuration" }));
  fireEvent.click(screen.getByRole("button", { name: "Notification saved" }));
  fireEvent.click(screen.getByRole("button", { name: "Endemic saved" }));
  fireEvent.click(screen.getByRole("button", { name: "Geographic saved" }));
  expect(getCatalogue).toHaveBeenCalledTimes(2);
});
