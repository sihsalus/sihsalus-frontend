const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { DatePicker, DatePickerInput } = require("@carbon/react");
const sass = require("sass");
const { chromium } = require("playwright");

test("Carbon date fields and calendar icons remain inside their filter columns", async () => {
  const carbonRoot = path.dirname(
    require.resolve("@carbon/styles/package.json"),
  );
  const source = fs.readFileSync(
    path.join(__dirname, "../src/dashboard.scss"),
    "utf8",
  );
  // Keep local class names stable for this isolated render; unwrap CSS Modules globals.
  const styles = source.replace(/:global\(([^)]+)\)/g, "$1");
  const css = sass.compileString(
    `@use 'scss/components/date-picker'; @include date-picker.date-picker();\n${styles}`,
    {
      loadPaths: [carbonRoot, path.resolve(carbonRoot, "../..")],
      logger: { warn() {}, debug() {} },
    },
  ).css;
  const labels = [
    "Inicio de sÃ­ntomas desde",
    "Inicio de sÃ­ntomas hasta",
    "NotificaciÃ³n desde",
    "NotificaciÃ³n hasta",
  ];
  const markup = renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "filters" },
      labels.map((label, index) =>
        React.createElement(
          DatePicker,
          {
            key: label,
            className: "dateInput",
            datePickerType: "single",
          },
          React.createElement(DatePickerInput, {
            id: `date-${index}`,
            labelText: label,
            placeholder: "DD/MM/AAAA",
          }),
        ),
      ),
    ),
  );
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage();
    for (const width of [1280, 947, 600, 375]) {
      await page.setViewportSize({ width, height: 600 });
      await page.setContent(`<style>${css}</style>${markup}`);
      const boxes = await page.locator(".dateInput").evaluateAll((fields) =>
        fields.map((field) => {
          const bounds = field.getBoundingClientRect();
          const input = field.querySelector("input").getBoundingClientRect();
          const icon = field.querySelector("svg").getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            inputLeft: input.left,
            inputRight: input.right,
            iconLeft: icon.left,
            iconRight: icon.right,
            width: input.width,
          };
        }),
      );
      for (const box of boxes) {
        assert.ok(
          box.inputLeft >= box.left - 1 && box.inputRight <= box.right + 1,
          `Input overflows at ${width}px: ${JSON.stringify(box)}`,
        );
        assert.ok(
          box.iconLeft >= box.inputLeft && box.iconRight <= box.inputRight,
          `Icon overflows at ${width}px`,
        );
        assert.ok(box.width > 150, `Date input is too narrow at ${width}px`);
      }
    }
  } finally {
    await browser.close();
  }
});
