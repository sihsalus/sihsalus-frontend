import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { openmrsFetch } from "@openmrs/esm-framework";
import { read } from "./api";
import { NotificationSettings } from "./notification-settings.component";

vi.mock("./api", () => ({
  apiBase: "/surveillance",
  read: vi.fn(),
  safeError: (e: unknown) => e,
}));
vi.mock("@openmrs/esm-framework", () => ({ openmrsFetch: vi.fn() }));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p>Error</p>,
}));

it("loads persisted settings and saves the selected day and minute as a JSON array", async () => {
  vi.mocked(read).mockResolvedValue([1, 12, 0]);
  vi.mocked(openmrsFetch).mockResolvedValue({ data: [2, 9, 30] } as never);
  const onSaved = vi.fn();
  render(<NotificationSettings onSaved={onSaved} />);
  fireEvent.click(screen.getByText("notificationSettings.configure"));
  expect(await screen.findByLabelText("notificationSettings.time")).toHaveValue(
    "12:00",
  );
  fireEvent.change(screen.getByLabelText("notificationSettings.day"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("notificationSettings.time"), {
    target: { value: "09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(openmrsFetch).toHaveBeenCalledWith(
    "/surveillance/configuration/notification",
    expect.objectContaining({ method: "PUT", body: "[2,9,30]" }),
  );
  expect(screen.getByText("notificationSettings.saved")).toBeInTheDocument();
});
