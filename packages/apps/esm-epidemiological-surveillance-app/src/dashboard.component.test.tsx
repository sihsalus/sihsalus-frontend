import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Dashboard from "./dashboard.component";
import { getCatalogue } from "./api";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  reportPrivilege,
  managePrivilege,
} from "./constants";
import { catalogue } from "./test-fixtures";
import { reloadSurveillancePage } from "./reload-surveillance";

const state = vi.hoisted(() => ({ user: "first", privileges: [] as string[] }));
vi.mock("@openmrs/esm-framework", () => ({
  useSession: () => ({ authenticated: true, user: { uuid: state.user } }),
}));
vi.mock("@sihsalus/esm-rbac", () => ({
  RequirePrivilege: ({
    privilege,
    children,
  }: {
    privilege: string;
    children: ReactNode;
  }) => (state.privileges.includes(privilege) ? children : null),
}));
vi.mock("./api", () => ({
  getCatalogue: vi.fn(),
  listSurveillanceCases: vi.fn().mockResolvedValue([]),
}));
vi.mock("./case-form.component", () => ({
  CaseForm: ({ onSaved }: { onSaved: () => void }) => (
    <div>
      Form: empty
      <button type="button" onClick={onSaved}>
        Case saved
      </button>
    </div>
  ),
}));
vi.mock("./reload-surveillance", () => ({ reloadSurveillancePage: vi.fn() }));
vi.mock("./demographic-panel.component", () => ({
  DemographicPanel: () => <div>Demographic content</div>,
}));
vi.mock("./age-groups.component", () => ({
  AgeGroupsPanel: () => <div>Age configuration</div>,
}));
vi.mock("./geographic-panel.component", () => ({
  GeographicPanel: () => <div>Geographic content</div>,
}));
vi.mock("./geographic-settings.component", () => ({
  GeographicSettings: () => <div>Geographic configuration</div>,
}));
vi.mock("./events-panel.component", () => ({
  EventsPanel: ({ onEventsChanged }: { onEventsChanged: () => void }) => (
    <button type="button" onClick={onEventsChanged}>
      Event saved
    </button>
  ),
}));
vi.mock("./cases-panel.component", () => ({
  CasesPanel: ({ onSaved }: { onSaved: () => void }) => (
    <button type="button" onClick={onSaved}>
      Case edited
    </button>
  ),
}));
vi.mock("./report-panel.component", () => ({
  ReportPanel: () => <div>Report content</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.user = "first";
  state.privileges = [
    caseRegisterPrivilege,
    caseViewPrivilege,
    reportPrivilege,
  ];
  vi.mocked(getCatalogue).mockReset().mockResolvedValue(catalogue);
});
it("requires both case privileges before mounting clinical components", async () => {
  state.privileges = [caseRegisterPrivilege];
  render(<Dashboard />);
  await screen.findByRole("tab", { name: "Cases" });
  expect(screen.queryByText("Form: empty")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "temporalInformation" }));
  expect(screen.queryByText("Report content")).not.toBeInTheDocument();
});
it("allows report readers without mounting the case form", async () => {
  state.privileges = [reportPrivilege];
  render(<Dashboard />);
  fireEvent.click(
    await screen.findByRole("tab", { name: "temporalInformation" }),
  );
  expect(screen.getByText("Report content")).toBeInTheDocument();
  expect(screen.queryByText("Form: empty")).not.toBeInTheDocument();
});
it("reloads the catalogue when the authenticated actor changes", async () => {
  const view = render(<Dashboard />);
  await screen.findByText("Form: empty");
  state.user = "second";
  view.rerender(<Dashboard />);
  await waitFor(() =>
    expect(screen.getByText("Form: empty")).toBeInTheDocument(),
  );
  expect(getCatalogue).toHaveBeenCalledTimes(2);
});

it("keeps indicators empty while gating geography, demographics and configuration", async () => {
  state.privileges = [reportPrivilege];
  render(<Dashboard />);
  await screen.findByRole("tab", { name: "Indicators" });
  fireEvent.click(screen.getByRole("tab", { name: "Indicators" }));
  expect(screen.getByRole("tabpanel")).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole("tab", { name: "geographic" }));
  expect(screen.getByText("Geographic content")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "demographic.title" }));
  expect(screen.getByText("Demographic content")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "configuration" }));
  expect(screen.queryByText("Age configuration")).not.toBeInTheDocument();
});

it("reloads the complete page after case creation, editing and event saves", async () => {
  state.privileges.push(managePrivilege);
  render(<Dashboard />);
  fireEvent.click(await screen.findByText("Case saved"));
  fireEvent.click(screen.getByText("Case edited"));
  fireEvent.click(screen.getByRole("tab", { name: "Events" }));
  fireEvent.click(screen.getByText("Event saved"));
  expect(reloadSurveillancePage).toHaveBeenCalledTimes(3);
});
