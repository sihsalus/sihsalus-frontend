const assert = require("node:assert/strict");
const test = require("node:test");
const {
  evaluateAuditReport,
  validatePatchInstallation,
} = require("./audit-patched-dependencies");

const finding = (name, id, url, version) =>
  JSON.stringify({
    value: name,
    children: {
      ID: id,
      URL: url,
      Severity: "high",
      "Tree Versions": [version],
    },
  });

const braces = finding(
  "braces",
  1240992,
  "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  "3.0.3",
);
const cache = finding(
  "http-cache-semantics",
  1240991,
  "https://github.com/advisories/GHSA-ch52-4w7c-c8xp",
  "4.2.0",
);

test("installed local patches protect the known exploit paths", () => {
  validatePatchInstallation();
});

test("audit accepts only the exact advisories covered by tested patches", () => {
  assert.deepEqual(evaluateAuditReport(`${braces}\n`, 1), ["braces"]);
  assert.throws(() => evaluateAuditReport(`${braces}\n${cache}\n`, 1));
  assert.deepEqual(evaluateAuditReport("", 0), []);
});

test("audit fails for new advisories and changed vulnerable versions", () => {
  assert.throws(() =>
    evaluateAuditReport(
      finding("__proto__", 1, "https://example.test", "1.0.0"),
      1,
    ),
  );
  assert.throws(() =>
    evaluateAuditReport(
      `${braces}\n${finding("other", 1, "https://example.test", "1.0.0")}`,
      1,
    ),
  );
  assert.throws(() =>
    evaluateAuditReport(
      finding("braces", 999, "https://example.test", "3.0.3"),
      1,
    ),
  );
  assert.throws(() =>
    evaluateAuditReport(
      finding(
        "braces",
        1240992,
        "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
        "3.0.4",
      ),
      1,
    ),
  );
});

test("audit fails closed for malformed output and command errors", () => {
  assert.throws(() => evaluateAuditReport("", 1));
  assert.throws(() => evaluateAuditReport("not-json", 1));
  assert.throws(() => evaluateAuditReport(braces, 0));
  assert.throws(() => evaluateAuditReport(braces, 2));
  assert.throws(() => evaluateAuditReport(braces, 1, "network error"));
});
