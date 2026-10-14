import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AgeGroupsPanel, ageGroupsFromBounds } from "./age-groups.component";
import { getAgeGroups, saveAgeGroups } from "./demographic.resource";
import type { AgeGroup } from "./demographic.types";
vi.mock("./demographic.resource", () => ({
  getAgeGroups: vi.fn(),
  saveAgeGroups: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
const starts = [0, 2, 12, 18, 30, 60];
const groups: AgeGroup[] = [
  "INFANTS",
  "CHILDREN",
  "ADOLESCENTS",
  "YOUNG_ADULTS",
  "ADULTS",
  "OLDER_ADULTS",
].map((key, i) => ({
  key,
  minAge: starts[i],
  maxAge: i === 5 ? null : starts[i + 1] - 1,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAgeGroups).mockResolvedValue(groups);
  vi.mocked(saveAgeGroups).mockResolvedValue(groups);
});
it("maintains consecutive ranges and rejects empty, overlapping or fractional bounds", () => {
  expect(
    ageGroupsFromBounds(groups, ["2", "11", "17", "29", "59"])?.[1].minAge,
  ).toBe(3);
  expect(
    ageGroupsFromBounds(groups, ["1", "11", "17", "29", "59"])?.[5],
  ).toMatchObject({ minAge: 60, maxAge: null });
  for (const value of ["", "-1", "1.5", "12", "2147483647"])
    expect(
      ageGroupsFromBounds(groups, [value, "11", "17", "29", "59"]),
    ).toBeUndefined();
});
it("loads and saves configuration then calls the refresh callback", async () => {
  const saved = vi.fn();
  render(<AgeGroupsPanel onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "configureAgeGroups" }));
  const max = await screen.findByLabelText("ageGroups.INFANTS · to");
  fireEvent.change(max, { target: { value: "2" } });
  expect(screen.getByLabelText("ageGroups.CHILDREN · from")).toHaveValue("3");
  fireEvent.click(screen.getByRole("button", { name: "saveAgeGroups" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(vi.mocked(saveAgeGroups).mock.calls[0][0][0].maxAge).toBe(2);
});
it("keeps unsaved boundaries on a rejected save and does not refresh", async () => {
  vi.mocked(saveAgeGroups).mockRejectedValueOnce(new Error("synthetic"));
  const saved = vi.fn();
  render(<AgeGroupsPanel onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "configureAgeGroups" }));
  fireEvent.change(await screen.findByLabelText("ageGroups.INFANTS · to"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "saveAgeGroups" }));
  await screen.findByText("Safe error");
  expect(screen.getByLabelText("ageGroups.INFANTS · to")).toHaveValue(2);
  expect(saved).not.toHaveBeenCalled();
});
