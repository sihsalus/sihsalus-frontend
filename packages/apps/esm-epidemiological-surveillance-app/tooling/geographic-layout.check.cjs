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

test("geographic map keeps both legends and attribution inside the viewport", async () => {
  const source = path.resolve(__dirname, "../src/geographic-map.component.tsx");
  const bundle = await build({
    entryPoints: [source],
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
              'export default { controls:"controls",map:"map",marker:"marker",legends:"legends",legendRow:"legendRow",attribution:"attribution" };',
          }));
        },
      },
    ],
  });
  const loaded = new Module(
    path.join(__dirname, "geographic-render.cjs"),
    module,
  );
  loaded.filename = path.join(__dirname, "geographic-render.cjs");
  loaded.paths = module.paths;
  loaded._compile(bundle.outputFiles[0].text, loaded.filename);
  const namespace = "@sihsalus/esm-epidemiological-surveillance-app";
  const instance = i18next.createInstance();
  await instance.init({
    lng: "es",
    defaultNS: namespace,
    resources: { es: { [namespace]: require("../translations/es.json") } },
  });
  const foci = ["ACTIVE", "RESIDUAL", "ELIMINATED"].map(
    (classification, i) => ({
      centerId: i,
      label: `Synthetic center ${i}`,
      total: 20,
      latitude: -3.7 + i * 0.1,
      longitude: -73.2 + i * 0.1,
      classification,
      risk: "HIGH",
      origins: {},
    }),
  );
  const markup = renderToStaticMarkup(
    React.createElement(
      I18nextProvider,
      { i18n: instance },
      React.createElement(loaded.exports.GeographicMap, {
        report: { foci, riskThresholds: [10, 20, 50] },
      }),
    ),
  );
  const carbon = fs.readFileSync(
    require.resolve("@carbon/styles/css/styles.css"),
    "utf8",
  );
  const css = sass.compile(
    path.resolve(__dirname, "../src/geographic.scss"),
  ).css;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage();
    // Synthetic tiles only: visual tests never download the public map provider's tiles.
    await page.route("https://tile.openstreetmap.org/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9eff2"/><path d="M0 0L256 256M256 0L0 256" stroke="#c6c6c6"/></svg>',
      }),
    );
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(
        `<style>${carbon}\n${css}\nbody{padding:16px}</style>${markup}`,
      );
      const map = await page.locator(".map").boundingBox();
      for (const selector of [".legends", ".attribution"]) {
        const item = await page.locator(selector).boundingBox();
        assert.ok(
          item.x >= map.x && item.x + item.width <= map.x + map.width + 1,
        );
        assert.ok(
          item.y >= map.y && item.y + item.height <= map.y + map.height + 1,
        );
      }
      assert.equal(await page.locator(".marker").count(), 3);
      assert.equal(await page.locator(".legends strong").count(), 2);
      if (process.env.GEOGRAPHIC_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.GEOGRAPHIC_SCREENSHOT_DIR, {
          recursive: true,
        });
        await page.screenshot({
          path: path.join(
            process.env.GEOGRAPHIC_SCREENSHOT_DIR,
            `geography-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
  } finally {
    await browser.close();
  }
});
