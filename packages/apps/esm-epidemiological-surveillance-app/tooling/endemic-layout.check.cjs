const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { build } = require("esbuild");
const sass = require("sass");
const { chromium } = require("playwright");
const i18next = require("i18next");
const { I18nextProvider } = require("react-i18next");

test("endemic periods remain readable and scroll inside the chart on narrow screens", async () => {
  const bundle = await build({
    entryPoints: [
      path.resolve(__dirname, "../src/endemic-chart.component.tsx"),
    ],
    bundle: true,
    platform: "node",
    packages: "external",
    write: false,
    jsx: "automatic",
    plugins: [
      {
        name: "styles",
        setup(builder) {
          builder.onLoad({ filter: /\.scss$/ }, () => ({
            loader: "js",
            contents:
              'export default {endemicChart:"endemicChart",chartScroll:"chartScroll",historyLegend:"historyLegend"}',
          }));
        },
      },
    ],
  });
  const loaded = new Module(path.join(__dirname, "endemic-render.cjs"), module);
  loaded.filename = path.join(__dirname, "endemic-render.cjs");
  loaded.paths = module.paths;
  loaded._compile(bundle.outputFiles[0].text, loaded.filename);
  const instance = i18next.createInstance();
  const namespace = "@sihsalus/esm-epidemiological-surveillance-app";
  await instance.init({
    lng: "es",
    defaultNS: namespace,
    resources: { es: { [namespace]: require("../translations/es.json") } },
  });
  const css = sass.compile(
    path.resolve(__dirname, "../src/dashboard.scss"),
  ).css;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage();
    for (const period of ["dia", "semana", "mes", "trimestre", "semestre"]) {
      const count = { dia: 31, semana: 12, mes: 9, trimestre: 3, semestre: 2 }[
        period
      ];
      const report = {
        from: "2026-01-01",
        period,
        diagnosisType: "CONFIRMADO",
        channel: Array.from({ length: count }, (_, i) => ({
          date: new Date(
            Date.UTC(
              2026,
              period === "dia" || period === "semana"
                ? 0
                : i * { mes: 1, trimestre: 3, semestre: 6 }[period],
              period === "dia" ? i + 1 : period === "semana" ? i * 7 + 4 : 1,
            ),
          )
            .toISOString()
            .slice(0, 10),
          cases: i % 7,
          q1: 1,
          q2: 3,
          q3: 5,
          historicalCases: { 2025: i % 5, 2024: i % 3 },
        })),
      };
      const markup = renderToStaticMarkup(
        React.createElement(
          I18nextProvider,
          { i18n: instance },
          React.createElement(loaded.exports.EndemicChart, {
            report,
            years: [2025, 2024],
            calendar: { firstDayOfWeek: "SUNDAY", minimalDaysInFirstWeek: 4 },
          }),
        ),
      );
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 600 });
        await page.setContent(
          `<style>${css} body{margin:0;padding:16px;font-family:Arial}*{box-sizing:border-box}</style>${markup}`,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const scroll = await page.locator(".chartScroll").boundingBox();
        const caption = await page.locator("figcaption").boundingBox();
        assert.ok(caption.y - scroll.y - scroll.height >= 23);
        assert.equal(
          await page.locator('svg text[transform*="rotate(-45)"]').count(),
          count,
        );
        assert.equal(await page.locator(".historyLegend li").count(), 3);
        if (process.env.ENDEMIC_SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.ENDEMIC_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({
            path: path.join(
              process.env.ENDEMIC_SCREENSHOT_DIR,
              `${period}-${width}.png`,
            ),
          });
        }
      }
    }
  } finally {
    await browser.close();
  }
});
