const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");

test("builds and typechecks the local framework before its workspace consumers", () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/turbo/bin/turbo"),
        "run",
        "typescript",
        "--dry=json",
      ],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 30_000,
        env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
      },
    ),
  );
  const tasks = new Map(plan.tasks.map((task) => [task.taskId, task]));
  let consumers = 0;
  for (const group of ["apps", "libs"]) {
    const directory = path.join(root, "packages", group);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(directory, entry.name, "package.json");
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (
        !manifest.peerDependencies?.["@openmrs/esm-framework"] ||
        !manifest.scripts?.typescript
      )
        continue;
      const task = tasks.get(`${manifest.name}#typescript`);
      assert.ok(task, `${manifest.name}: typecheck is absent from the plan`);
      for (const prerequisite of ["build", "typescript"]) {
        assert.ok(
          task.dependencies.includes(`@openmrs/esm-framework#${prerequisite}`),
          `${manifest.name}: typecheck can run before framework ${prerequisite}`,
        );
      }
      consumers++;
    }
  }
  assert.ok(consumers > 0, "No framework consumers were checked");
});
