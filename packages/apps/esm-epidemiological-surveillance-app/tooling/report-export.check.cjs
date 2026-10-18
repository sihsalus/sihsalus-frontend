const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { rspack } = require("@rspack/core");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { chromium } = require("playwright");

test("PNG/JPG include full scrollable graphics, SVG map tiles, markers and HTML legends", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "report-export-"));
  const compiler = rspack({
    mode: "development",
    target: "web",
    devtool: false,
    entry: path.resolve(__dirname, "../src/report-export.ts"),
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: "builtin:swc-loader",
          options: { jsc: { parser: { syntax: "typescript" } } },
        },
      ],
    },
    resolve: { extensions: [".ts", ".js"] },
    output: {
      path: directory,
      filename: "export.js",
      library: { type: "var", name: "reportExport" },
    },
    plugins: [new rspack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  });
  let bundle;
  try {
    const stats = await new Promise((resolve, reject) =>
      compiler.run((error, stats) => (error ? reject(error) : resolve(stats))),
    );
    assert.equal(
      stats.hasErrors(),
      false,
      stats.toString({ all: false, errors: true }),
    );
    bundle = readFileSync(path.join(directory, "export.js"), "utf8");
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  try {
    const page = await browser.newPage();
    await page.route("https://export.test/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#00ff00"/></svg>',
      }),
    );
    await page.setContent(`<style>body{margin:0}.scroll{overflow:auto;max-width:100%}.scroll svg{display:block;width:100%;height:200px}</style>
      <div id="chart" style="width:300px"><div data-export-exclude>Controls</div><div class="scroll" data-export-scroll><svg viewBox="0 0 1200 200" style="min-width:1200px"><rect x="1150" width="50" height="200" fill="red"/></svg></div><div style="height:40px;background:blue">Legend</div></div>
      <div id="map" style="width:800px"><div style="position:relative"><svg viewBox="0 0 800 480" style="display:block;width:100%"><image href="https://export.test/tile.svg" width="256" height="256"/><foreignObject x="300" y="100" width="24" height="24"><button style="border:0;padding:0;background:transparent"><svg width="24" height="24"><circle cx="12" cy="12" r="10" fill="red"/></svg></button></foreignObject></svg><div style="position:absolute;right:0;bottom:30px;width:150px;height:60px;background:blue">Risk legend</div><div style="position:absolute;bottom:0;right:0">© OpenStreetMap contributors</div></div></div>`);
    await page.addScriptTag({ content: bundle });
    assert.deepEqual(
      await page.evaluate(async () => {
        const blob = await reportExport.tableBlob(
          [
            ["Center", "Cases"],
            ["Synthetic", 12],
          ],
          "xlsx",
        );
        return Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 4));
      }),
      [80, 75, 3, 4],
    );
    const results = await page.evaluate(async () => {
      const results = [];
      for (const id of ["chart", "map"]) {
        for (const format of ["png", "jpg"]) {
          const blob = await reportExport.imageBlob(
            document.getElementById(id),
            format,
          );
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0);
          const pixel = (x, y) =>
            Array.from(ctx.getImageData(x * 2, y * 2, 1, 1).data).slice(0, 3);
          results.push({
            id,
            format,
            type: blob.type,
            width: bitmap.width,
            height: bitmap.height,
            colors:
              id === "chart"
                ? [pixel(1175, 100), pixel(100, 220)]
                : [pixel(100, 100), pixel(312, 112), pixel(700, 420)],
          });
        }
      }
      return results;
    });
    for (const result of results) {
      assert.equal(
        result.type,
        result.format === "png" ? "image/png" : "image/jpeg",
      );
      assert.equal(result.width, result.id === "chart" ? 2400 : 1600);
      assert.equal(result.height, result.id === "chart" ? 480 : 960);
      const expected =
        result.id === "chart"
          ? [
              [255, 0, 0],
              [0, 0, 255],
            ]
          : [
              [0, 255, 0],
              [255, 0, 0],
              [0, 0, 255],
            ];
      result.colors.forEach((color, i) => {
        color.forEach((value, j) => {
          assert.ok(
            Math.abs(value - expected[i][j]) < 10,
            JSON.stringify(result),
          );
        });
      });
    }
    await page.route("https://export.test/**", (route) => route.abort());
    assert.equal(
      await page.evaluate(async () => {
        try {
          await reportExport.imageBlob(document.getElementById("map"), "png");
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
    assert.equal(
      await page.locator('body > div[style*="-100000px"]').count(),
      0,
    );
  } finally {
    await browser.close();
  }
});
