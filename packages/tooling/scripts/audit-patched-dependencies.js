const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const patched = {
  braces: {
    version: "3.0.3",
    advisory: 1240992,
    url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    ranges: ["npm:~3.0.2", "npm:^3.0.3"],
    patch: "braces-npm-3.0.3-582c14023c.patch",
  },
  "http-cache-semantics": {
    version: "4.2.0",
    advisory: 1240991,
    url: "https://github.com/advisories/GHSA-ch52-4w7c-c8xp",
    ranges: ["npm:^4.1.1", "npm:^4.2.0"],
    patch: "http-cache-semantics-npm-4.2.0-fadacfb3ad.patch",
  },
};

function validatePatchInstallation() {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const lock = readFileSync(path.join(root, "yarn.lock"), "utf8");
  const found = new Map(Object.keys(patched).map((name) => [name, new Set()]));

  for (const match of lock.matchAll(
    /^    (braces|http-cache-semantics): "([^"]+)"$/gm,
  )) {
    found.get(match[1]).add(match[2]);
  }

  for (const [name, policy] of Object.entries(patched)) {
    const patchPath = path.join(root, ".yarn/patches", policy.patch);
    assert.ok(existsSync(patchPath), `Missing ${patchPath}`);
    assert.deepEqual(
      [...found.get(name)].sort(),
      [...policy.ranges].sort(),
      `Unexpected ${name} dependency range`,
    );

    const patchResolution = `patch:${name}@npm%3A${policy.version}#~/.yarn/patches/${policy.patch}`;
    for (const range of policy.ranges) {
      assert.equal(manifest.resolutions[`${name}@${range}`], patchResolution);
    }
    assert.ok(
      lock.includes(`"${name}@${patchResolution}":`),
      `Missing ${name} patch in lockfile`,
    );
    assert.equal(require(`${name}/package.json`).version, policy.version);
  }

  const braces = require("braces");
  assert.deepEqual(braces.expand("{a,b}"), ["a", "b"]);
  assert.throws(
    () => braces.expand(`${"{".repeat(4000)}x${"}".repeat(4000)}`),
    { name: "SyntaxError", message: /nesting exceeds max depth/ },
  );

  const CachePolicy = require("http-cache-semantics");
  const request = {
    url: "https://example.test/item",
    method: "GET",
    headers: {},
  };
  const staleRequest = {
    ...request,
    headers: { "cache-control": "max-stale=3600" },
  };
  const reusable = (headers) =>
    new CachePolicy(request, {
      status: 200,
      headers,
    }).satisfiesWithoutRevalidation(staleRequest);
  assert.equal(
    reusable({
      "cache-control": "max-age=120",
      "set-cookie": "session=example",
    }),
    false,
  );
  assert.equal(
    reusable({ "cache-control": "max-age=120, proxy-revalidate" }),
    false,
  );
  assert.equal(reusable({ "cache-control": "max-age=120, no-cache" }), false);
  assert.equal(reusable({ "cache-control": "max-age=120, private" }), false);
  assert.equal(reusable({ "cache-control": "max-age=120, no-store" }), false);
  assert.equal(reusable({ "cache-control": "max-age=120" }), true);
}

function evaluateAuditReport(stdout, status, stderr = "") {
  assert.ok(status === 0 || status === 1, `Audit exited with status ${status}`);
  assert.equal(stderr.trim(), "", `Audit produced stderr: ${stderr.trim()}`);
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  const findings = lines.map((line) => JSON.parse(line));

  if (status === 0) {
    assert.equal(
      findings.length,
      0,
      "Audit returned findings with successful exit status",
    );
    return [];
  }
  assert.ok(findings.length > 0, "Audit failed without a finding");

  for (const finding of findings) {
    assert.ok(
      Object.hasOwn(patched, finding.value),
      `Unreviewed audit finding: ${finding.value}`,
    );
    const policy = patched[finding.value];
    const details = finding.children;
    assert.equal(
      details?.ID,
      policy.advisory,
      `Unreviewed ${finding.value} advisory`,
    );
    assert.equal(details.URL, policy.url);
    assert.equal(details.Severity, "high");
    assert.deepEqual(details["Tree Versions"], [policy.version]);
  }
  return findings.map((finding) => finding.value);
}

function main() {
  validatePatchInstallation();
  const result = spawnSync(
    "yarn",
    ["npm", "audit", "--all", "--recursive", "--severity", "high", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  const accepted = evaluateAuditReport(
    result.stdout,
    result.status,
    result.stderr,
  );
  console.log(
    accepted.length
      ? `Audit complete: local patches verified for ${accepted.join(", ")}; no other high-severity findings.`
      : "Audit complete: no high-severity findings.",
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { evaluateAuditReport, validatePatchInstallation };
