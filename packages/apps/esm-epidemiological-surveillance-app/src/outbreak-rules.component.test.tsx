import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { OutbreakRulesSettings } from "./outbreak-rules.component";
import {
  getOutbreakRules,
  saveOutbreakRules,
  newOutbreakRule,
  validOutbreakRules,
} from "./outbreak-rules.resource";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./outbreak-rules.resource", async (original) => ({
  ...(await original<typeof import("./outbreak-rules.resource")>()),
  getOutbreakRules: vi.fn(),
  saveOutbreakRules: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOutbreakRules).mockResolvedValue([
    newOutbreakRule("a", "THRESHOLD"),
    newOutbreakRule("b", "CONSECUTIVE"),
    newOutbreakRule("c", "FOCUS_CASES"),
  ]);
  vi.mocked(saveOutbreakRules).mockResolvedValue([]);
});
it("edits all three structures, adds a rule and confirms persistence", async () => {
  render(<OutbreakRulesSettings />);
  fireEvent.click(
    screen.getByRole("button", { name: "outbreakRules.configure" }),
  );
  await screen.findByLabelText("outbreakRules.weeks");
  fireEvent.change(screen.getAllByLabelText("outbreakRules.percentile")[0], {
    target: { value: "90" },
  });
  fireEvent.change(screen.getByLabelText("outbreakRules.weeks"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("outbreakRules.minimumCases"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("outbreakRules.focus"), {
    target: { value: "ACTIVE" },
  });
  fireEvent.change(screen.getByLabelText("outbreakRules.origin"), {
    target: { value: "IMPORTADO_NACIONAL" },
  });
  fireEvent.click(screen.getByRole("button", { name: "outbreakRules.add" }));
  fireEvent.change(screen.getAllByLabelText("outbreakRules.type")[3], {
    target: { value: "CONSECUTIVE" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await screen.findByText("outbreakRules.saved");
  const payload = vi.mocked(saveOutbreakRules).mock.calls[0][0];
  expect(payload).toHaveLength(4);
  expect(payload[0]).toMatchObject({ id: "a", percentile: 90 });
  expect(payload[1]).toMatchObject({ id: "b", weeks: 3 });
  expect(payload[2]).toMatchObject({
    minimumCases: 2,
    origin: "IMPORTADO_NACIONAL",
    focus: "ACTIVE",
  });
  expect(payload[3]).toMatchObject({ type: "CONSECUTIVE", weeks: 2 });
});
it("rejects invalid values and preserves drafts after a failed save", async () => {
  vi.mocked(saveOutbreakRules).mockRejectedValue(new Error("synthetic"));
  render(<OutbreakRulesSettings />);
  fireEvent.click(
    screen.getByRole("button", { name: "outbreakRules.configure" }),
  );
  const weeks = await screen.findByLabelText("outbreakRules.weeks");
  for (const value of ["", "0", "1.5", "54"]) {
    fireEvent.change(weeks, { target: { value } });
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  }
  fireEvent.change(weeks, { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await screen.findByText("Safe error");
  expect(weeks).toHaveValue(4);
  expect(screen.queryByText("outbreakRules.saved")).not.toBeInTheDocument();
});
it("cancels changes and reloads persisted rules on reopening", async () => {
  render(<OutbreakRulesSettings />);
  fireEvent.click(
    screen.getByRole("button", { name: "outbreakRules.configure" }),
  );
  fireEvent.change(await screen.findByLabelText("outbreakRules.weeks"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(saveOutbreakRules).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "outbreakRules.configure" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("outbreakRules.weeks")).toHaveValue(2),
  );
});
it("validates percentile and count boundaries", () => {
  const rule = newOutbreakRule("a", "THRESHOLD");
  for (const percentile of [0, 75.5, 100])
    expect(validOutbreakRules([{ ...rule, percentile }])).toBe(true);
  for (const percentile of [null, -1, 101, Number.NaN])
    expect(validOutbreakRules([{ ...rule, percentile }])).toBe(false);
  const focus = newOutbreakRule("b", "FOCUS_CASES");
  for (const minimumCases of [-1, 0.5, 2147483647, null])
    expect(validOutbreakRules([{ ...focus, minimumCases }])).toBe(false);
  expect(validOutbreakRules([{ ...focus, minimumCases: 2147483646 }])).toBe(
    true,
  );
});
