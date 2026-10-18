import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TableSettings, useTableAppearance } from "./table-settings.component";
import { moduleName } from "./constants";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
function Harness({ user }: { user: string }) {
  const settings = useTableAppearance(user);
  return (
    <div data-testid="tables" style={settings.style}>
      <TableSettings {...settings} />
    </div>
  );
}
beforeEach(() => {
  localStorage.clear();
});
it("applies header and body preferences separately and restores them only for their user", () => {
  const { rerender } = render(<Harness key="a" user="a" />);
  fireEvent.click(screen.getByRole("button", { name: "tableSettings.title" }));
  const header = within(
    screen.getByRole("group", { name: "tableSettings.header" }),
  );
  const body = within(
    screen.getByRole("group", { name: "tableSettings.body" }),
  );
  fireEvent.change(header.getByLabelText("tableSettings.size"), {
    target: { value: "24" },
  });
  fireEvent.change(header.getByLabelText("tableSettings.align"), {
    target: { value: "center" },
  });
  fireEvent.change(body.getByLabelText("tableSettings.align"), {
    target: { value: "right" },
  });
  expect(localStorage.getItem(`${moduleName}:table-appearance:a`)).toBeNull();
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-size"),
  ).toBe("14px");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-size"),
  ).toBe("24px");
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-body-size"),
  ).toBe("14px");
  rerender(<Harness key="b" user="b" />);
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-size"),
  ).toBe("14px");
  rerender(<Harness key="a" user="a" />);
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-size"),
  ).toBe("24px");
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-align"),
  ).toBe("center");
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-body-align"),
  ).toBe("right");
});
it("uses defaults for corrupted saved settings", () => {
  localStorage.setItem(
    `${moduleName}:table-appearance:a`,
    JSON.stringify({ headerSize: 999, bodyAlign: "invalid" }),
  );
  render(<Harness user="a" />);
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-header-size"),
  ).toBe("14px");
  expect(
    screen
      .getByTestId("tables")
      .style.getPropertyValue("--surveillance-body-align"),
  ).toBe("left");
});

it("discards changes when the modal is cancelled", () => {
  render(<Harness user="a" />);
  fireEvent.click(screen.getByRole("button", { name: "tableSettings.title" }));
  fireEvent.change(
    within(
      screen.getByRole("group", { name: "tableSettings.header" }),
    ).getByLabelText("tableSettings.size"),
    { target: { value: "24" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(localStorage.getItem(`${moduleName}:table-appearance:a`)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "tableSettings.title" }));
  expect(
    within(
      screen.getByRole("group", { name: "tableSettings.header" }),
    ).getByLabelText("tableSettings.size"),
  ).toHaveValue("14");
});
