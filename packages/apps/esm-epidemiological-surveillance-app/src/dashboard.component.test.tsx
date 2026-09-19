import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Dashboard from "./dashboard.component";
import { getCatalogue } from "./api";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  reportPrivilege,
} from "./constants";
import { catalogue, request } from "./test-fixtures";

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
vi.mock("./api", () => ({ getCatalogue: vi.fn() }));
vi.mock("./case-form.component", () => ({
  CaseForm: ({ initial }: { initial?: typeof request }) => (
    <div>Form: {initial?.patientUuid ?? "empty"}</div>
  ),
}));
vi.mock("./pending-cases.component", () => ({
  PendingCases: ({ onReview }: { onReview: (r: typeof request) => void }) => (
    <button type="button" onClick={() => onReview(request)}>
      Review draft
    </button>
  ),
}));
vi.mock("./report-panel.component", () => ({
  ReportPanel: () => <div>Report content</div>,
}));

beforeEach(() => {
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
  fireEvent.click(screen.getByRole("tab", { name: "Indicators" }));
  expect(screen.queryByText("Report content")).not.toBeInTheDocument();
});
it("allows report readers without mounting the case form", async () => {
  state.privileges = [reportPrivilege];
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole("tab", { name: "Indicators" }));
  expect(screen.getByText("Report content")).toBeInTheDocument();
  expect(screen.queryByText("Form: empty")).not.toBeInTheDocument();
});
it("clears patient drafts immediately when the authenticated actor changes", async () => {
  const view = render(<Dashboard />);
  fireEvent.click(await screen.findByText("Review draft"));
  expect(screen.getByText("Form: patient")).toBeInTheDocument();
  state.user = "second";
  view.rerender(<Dashboard />);
  expect(screen.queryByText("Form: patient")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByText("Form: empty")).toBeInTheDocument(),
  );
  expect(getCatalogue).toHaveBeenCalledTimes(2);
});
