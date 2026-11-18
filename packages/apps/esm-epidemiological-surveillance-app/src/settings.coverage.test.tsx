import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { openmrsFetch } from "@openmrs/esm-framework";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { read } from "./api";
import { AgeGroupsPanel } from "./age-groups.component";
import { getAgeGroups } from "./demographic.resource";
import { EndemicSettings } from "./endemic-settings.component";
import { GeographicSettings } from "./geographic-settings.component";
import { getRiskThresholds, saveRiskThresholds } from "./geographic.resource";
import { NotificationSettings } from "./notification-settings.component";
import { OutbreakRulesSettings } from "./outbreak-rules.component";
import { getOutbreakRules, newOutbreakRule, saveOutbreakRules } from "./outbreak-rules.resource";
import { TableSettings, useTableAppearance } from "./table-settings.component";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@openmrs/esm-framework", () => ({ openmrsFetch: vi.fn(), restBaseUrl: "/ws/rest/v1" }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), read: vi.fn() }));
vi.mock("./demographic.resource", () => ({ getAgeGroups: vi.fn(), saveAgeGroups: vi.fn() }));
vi.mock("./outbreak-rules.resource", async (original) => ({
  ...(await original<typeof import("./outbreak-rules.resource")>()),
  getOutbreakRules: vi.fn(),
  saveOutbreakRules: vi.fn(),
}));
vi.mock("./geographic.resource", async (original) => ({
  ...(await original<typeof import("./geographic.resource")>()),
  getRiskThresholds: vi.fn(),
  saveRiskThresholds: vi.fn(),
  importCoordinates: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({ ErrorNotification: () => <p role="alert">Safe error</p> }));

const closeNotification = () =>
  fireEvent.click(screen.getAllByRole("button", { name: /close notification/i })[0]);

beforeEach(() => vi.clearAllMocks());

describe("configuration panels", () => {
  it("retries age groups and closes the modal by both controls", async () => {
    vi.mocked(getAgeGroups).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    render(<AgeGroupsPanel onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "configureAgeGroups" }));
    fireEvent.click(await screen.findByRole("button", { name: "retry" }));
    await waitFor(() => expect(getAgeGroups).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "configureAgeGroups" }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("button", { name: "saveAgeGroups" })).not.toBeInTheDocument();
  });

  it("retries outbreak rules and dismisses the saved notice", async () => {
    vi.mocked(getOutbreakRules)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue([newOutbreakRule("a", "THRESHOLD")]);
    vi.mocked(saveOutbreakRules).mockResolvedValue([]);
    render(<OutbreakRulesSettings />);
    fireEvent.click(screen.getByRole("button", { name: "outbreakRules.configure" }));
    fireEvent.click(await screen.findByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getAllByLabelText("outbreakRules.percentile").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("outbreakRules.saved");
    closeNotification();
    expect(screen.queryByText("outbreakRules.saved")).not.toBeInTheDocument();
  });

  it("retries notification settings, reports a save failure and dismisses success", async () => {
    vi.mocked(read).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([1, 12, 0]);
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error("rejected")).mockResolvedValue({ data: [1, 12, 0] } as never);
    render(<NotificationSettings onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText("notificationSettings.configure"));
    fireEvent.click(await screen.findByRole("button", { name: "retry" }));
    await screen.findByLabelText("notificationSettings.time");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("notificationSettings.saved");
    closeNotification();
    fireEvent.click(screen.getByText("notificationSettings.configure"));
    fireEvent.click(await screen.findByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
  });

  it("retries endemic settings and dismisses the saved notice", async () => {
    vi.mocked(read).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([5, 3]);
    vi.mocked(openmrsFetch).mockResolvedValue({ data: [5, 3] } as never);
    render(<EndemicSettings onSaved={vi.fn()} currentYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: "endemic.configure" }));
    fireEvent.click(await screen.findByRole("button", { name: "retry" }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("endemic.saved");
    closeNotification();
    expect(screen.queryByText("endemic.saved")).not.toBeInTheDocument();
  });

  it("retries risk thresholds, saves them and reports unreadable coordinate files", async () => {
    vi.mocked(getRiskThresholds).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([10, 20, 50]);
    vi.mocked(saveRiskThresholds).mockResolvedValue([10, 20, 50]);
    render(<GeographicSettings onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "geo.configureRisk" }));
    fireEvent.click(await screen.findByRole("button", { name: "retry" }));
    await screen.findByLabelText("geo.risk.MEDIUM");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("geo.riskSaved");
    closeNotification();
    fireEvent.click(screen.getByRole("button", { name: "geo.configureCoordinates" }));
    const file = new File(["x"], "points.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.reject(new Error("unreadable")) });
    fireEvent.change(screen.getByLabelText("geo.csvFile"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Safe error");
  });

  it("falls back to defaults and reports storage failures", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    function Harness() {
      const settings = useTableAppearance("user");
      return <TableSettings {...settings} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "tableSettings.title" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(setItem).toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("tableSettings.saved");
    closeNotification();
    expect(screen.queryByText("tableSettings.saved")).not.toBeInTheDocument();
  });
});
