const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

test("production build includes every investigation PDF unchanged", () => {
  const root = join(__dirname, "..");
  const source = join(root, "src/assets/forms");
  const dist = join(root, "dist");
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const emitted = readdirSync(dist)
    .filter((name) => name.endsWith(".pdf"))
    .map((name) => digest(readFileSync(join(dist, name))));
  const files = readdirSync(source).filter((name) => name.endsWith(".pdf"));
  assert.equal(files.length, 29);
  const imports = readFileSync(
    join(root, "src/investigation-forms.ts"),
    "utf8",
  );
  for (const name of files) {
    assert.ok(
      imports.includes(`./assets/forms/${name}`),
      `${name} not linked to the catalogue`,
    );
    const bytes = readFileSync(join(source, name));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert.ok(
      emitted.includes(digest(bytes)),
      `${name} missing or altered in build`,
    );
  }
  const sources = JSON.parse(
    readFileSync(join(source, "sources.json"), "utf8"),
  );
  for (const form of sources) {
    assert.equal(
      digest(readFileSync(join(source, `${form.id}.pdf`))),
      form.sha256,
    );
    assert.equal(new URL(form.source).protocol, "https:");
  }
});
