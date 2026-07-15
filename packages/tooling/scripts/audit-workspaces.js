#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const scanRoots = [path.join(repoRoot, 'packages/apps'), path.join(repoRoot, 'packages/libs')];
const reportOnly = process.argv.includes('--report-only');
const showHelp = process.argv.includes('--help') || process.argv.includes('-h');

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectoryNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache', '.rspack']);
const hardLimit = 80;
const inventoryLimit = 40;

function main() {
  if (showHelp) {
    printHelp();
    return;
  }

  const routesFiles = scanRoots.flatMap((scanRoot) =>
    findFiles(scanRoot, (filePath) => path.basename(filePath) === 'routes.json'),
  );
  const sourceFiles = scanRoots.flatMap((scanRoot) =>
    findFiles(scanRoot, (filePath) => sourceExtensions.has(path.extname(filePath))),
  );
  const productionSourceFiles = sourceFiles.filter(isProductionSourceFile);
  const routeInventory = collectRouteInventory(routesFiles);
  const hardFailures = [
    ...findDuplicateDefinitions(routeInventory),
    ...findInvalidWorkspace2Hierarchy(routeInventory),
    ...findInvalidLaunchWorkspace2Calls(productionSourceFiles, routeInventory),
  ];
  const migrationInventory = collectMigrationInventory(sourceFiles, routeInventory);

  printSummary(routeInventory, hardFailures, migrationInventory);

  if (hardFailures.length > 0 && !reportOnly) {
    process.exit(1);
  }
}

function isProductionSourceFile(filePath) {
  const normalizedPath = filePath.split(path.sep).join('/');
  return !/(?:^|\/)(?:__tests__|test-utils)(?:\/|$)|\.(?:test|spec)\.[^/]+$/u.test(normalizedPath);
}

function printHelp() {
  console.log(`Usage: node packages/tooling/scripts/audit-workspaces.js [--report-only]

Checks Workspace V2 registration correctness and reports remaining Workspace V1 migration surface.

Options:
  --report-only  Print the same report but always exit 0.
  --help, -h     Show this help.`);
}

function findFiles(directory, predicate, results = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      findFiles(filePath, predicate, results);
    } else if (entry.isFile() && predicate(filePath)) {
      results.push(filePath);
    }
  }

  return results.sort();
}

function collectRouteInventory(routesFiles) {
  const inventory = {
    routesFiles,
    legacyWorkspaces: [],
    workspace2s: [],
    workspaceWindows2: [],
    legacyWorkspaceGroups: [],
    workspaceGroups2: [],
    extensions: [],
    workspace2ByName: new Map(),
    legacyWorkspaceByName: new Map(),
    workspaceWindow2ByName: new Map(),
    workspaceGroup2ByName: new Map(),
    legacyWorkspaceGroupByName: new Map(),
    extensionByName: new Map(),
  };

  for (const filePath of routesFiles) {
    const relativePath = toRelativePath(filePath);
    const routes = readJson(filePath);

    addDefinitions(inventory.legacyWorkspaces, inventory.legacyWorkspaceByName, routes.workspaces, relativePath);
    addDefinitions(inventory.workspace2s, inventory.workspace2ByName, routes.workspaces2, relativePath);
    addDefinitions(
      inventory.workspaceWindows2,
      inventory.workspaceWindow2ByName,
      routes.workspaceWindows2,
      relativePath,
    );
    addDefinitions(
      inventory.legacyWorkspaceGroups,
      inventory.legacyWorkspaceGroupByName,
      routes.workspaceGroups,
      relativePath,
    );
    addDefinitions(inventory.workspaceGroups2, inventory.workspaceGroup2ByName, routes.workspaceGroups2, relativePath);
    addDefinitions(inventory.extensions, inventory.extensionByName, routes.extensions, relativePath);
  }

  return inventory;
}

function addDefinitions(list, map, definitions, filePath) {
  if (!Array.isArray(definitions)) {
    return;
  }

  for (const definition of definitions) {
    const item = {
      ...definition,
      filePath,
    };
    list.push(item);

    if (typeof definition.name !== 'string' || definition.name.length === 0) {
      continue;
    }

    if (!map.has(definition.name)) {
      map.set(definition.name, []);
    }
    map.get(definition.name).push(item);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${toRelativePath(filePath)}: ${error.message}`);
  }
}

function findDuplicateDefinitions(inventory) {
  const failures = [];
  const groups = [
    ['workspace2', inventory.workspace2ByName],
    ['workspaceWindow2', inventory.workspaceWindow2ByName],
    ['workspaceGroup2', inventory.workspaceGroup2ByName],
  ];

  for (const [definitionType, definitionsByName] of groups) {
    for (const [name, definitions] of definitionsByName.entries()) {
      if (definitions.length <= 1) {
        continue;
      }

      failures.push({
        type: 'duplicate-definition',
        message: `${definitionType} "${name}" is registered ${definitions.length} times.`,
        locations: definitions.map((definition) => definition.filePath),
      });
    }
  }

  return failures;
}

function findInvalidWorkspace2Hierarchy(inventory) {
  const failures = [];

  for (const workspace of inventory.workspace2s) {
    if (typeof workspace.window !== 'string' || workspace.window.length === 0) {
      failures.push({
        type: 'workspace2-missing-window',
        message: `Workspace V2 "${workspace.name}" does not declare a workspace window.`,
        locations: [workspace.filePath],
      });
      continue;
    }

    if (!inventory.workspaceWindow2ByName.has(workspace.window)) {
      failures.push({
        type: 'workspace2-unknown-window',
        message: `Workspace V2 "${workspace.name}" points to missing window "${workspace.window}".`,
        locations: [workspace.filePath],
      });
    }
  }

  for (const windowDefinition of inventory.workspaceWindows2) {
    if (typeof windowDefinition.group !== 'string' || windowDefinition.group.length === 0) {
      failures.push({
        type: 'workspace-window2-missing-group',
        message: `Workspace window V2 "${windowDefinition.name}" does not declare a workspace group.`,
        locations: [windowDefinition.filePath],
      });
      continue;
    }

    if (!inventory.workspaceGroup2ByName.has(windowDefinition.group)) {
      failures.push({
        type: 'workspace-window2-unknown-group',
        message: `Workspace window V2 "${windowDefinition.name}" points to missing group "${windowDefinition.group}".`,
        locations: [windowDefinition.filePath],
      });
    }
  }

  return failures;
}

function findInvalidLaunchWorkspace2Calls(sourceFiles, inventory) {
  const failures = [];

  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const relativePath = toRelativePath(sourceFile);
    const launchWorkspace2Calls = findLiteralCalls(source, 'launchWorkspace2');

    for (const call of launchWorkspace2Calls) {
      const workspaceName = call.argument;
      if (inventory.workspace2ByName.has(workspaceName)) {
        continue;
      }

      failures.push({
        type: 'launch-workspace2-unregistered',
        message: `launchWorkspace2("${workspaceName}") targets a workspace that is not registered in workspaces2.`,
        locations: [`${relativePath}:${call.line}`],
        details: describeNonWorkspace2Target(workspaceName, inventory),
      });
    }
  }

  return failures;
}

function describeNonWorkspace2Target(workspaceName, inventory) {
  if (inventory.legacyWorkspaceByName.has(workspaceName)) {
    return `Registered only as legacy workspace in ${joinLocations(inventory.legacyWorkspaceByName.get(workspaceName))}.`;
  }

  if (inventory.extensionByName.has(workspaceName)) {
    return `Registered only as extension in ${joinLocations(inventory.extensionByName.get(workspaceName))}.`;
  }

  return 'No route registration found.';
}

function collectMigrationInventory(sourceFiles, routeInventory) {
  return {
    legacyWorkspaceFiles: summarizeDefinitionsByFile(routeInventory.legacyWorkspaces),
    legacyWorkspaceGroupFiles: summarizeDefinitionsByFile(routeInventory.legacyWorkspaceGroups),
    workspaceContainerReferences: findIdentifierReferences(sourceFiles, 'WorkspaceContainer'),
    actionMenuButtonReferences: findIdentifierReferences(sourceFiles, 'ActionMenuButton'),
    launchWorkspaceReferences: [
      ...findCallReferences(sourceFiles, 'launchWorkspace'),
      ...findCallReferences(sourceFiles, 'launchWorkspaceGroup'),
    ].sort(compareReferences),
    promptBeforeClosingReferences: findIdentifierReferences(sourceFiles, 'promptBeforeClosing'),
    dynamicLaunchWorkspace2References: findDynamicLaunchWorkspace2References(sourceFiles),
  };
}

function summarizeDefinitionsByFile(definitions) {
  const countsByFile = new Map();
  for (const definition of definitions) {
    countsByFile.set(definition.filePath, (countsByFile.get(definition.filePath) ?? 0) + 1);
  }

  return [...countsByFile.entries()]
    .map(([filePath, count]) => ({ filePath, count }))
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function findIdentifierReferences(sourceFiles, identifier) {
  const references = [];
  const expression = new RegExp(`\\b${escapeRegExp(identifier)}\\b`, 'g');

  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const relativePath = toRelativePath(sourceFile);
    const matches = findMatches(source, expression).filter((match) => {
      if (identifier === 'ActionMenuButton') {
        return source.slice(match.index, match.index + 'ActionMenuButton2'.length) !== 'ActionMenuButton2';
      }
      return true;
    });

    for (const match of matches) {
      references.push({ filePath: relativePath, line: getLineNumber(source, match.index) });
    }
  }

  return references.sort(compareReferences);
}

function findCallReferences(sourceFiles, functionName) {
  const references = [];
  const expression = new RegExp(`\\b${escapeRegExp(functionName)}\\s*\\(`, 'g');

  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const relativePath = toRelativePath(sourceFile);

    for (const match of findMatches(source, expression)) {
      references.push({ filePath: relativePath, line: getLineNumber(source, match.index) });
    }
  }

  return references.sort(compareReferences);
}

function findDynamicLaunchWorkspace2References(sourceFiles) {
  const references = [];

  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const relativePath = toRelativePath(sourceFile);
    const allCalls = findCallReferences([sourceFile], 'launchWorkspace2');
    const literalCalls = new Set(findLiteralCalls(source, 'launchWorkspace2').map((call) => call.line));

    for (const call of allCalls) {
      if (!literalCalls.has(call.line)) {
        references.push({ filePath: relativePath, line: call.line });
      }
    }
  }

  return references.sort(compareReferences);
}

function findLiteralCalls(source, functionName) {
  const expression = new RegExp(`\\b${escapeRegExp(functionName)}\\s*\\(\\s*(['"])([^'"]+)\\1`, 'g');
  return findMatches(source, expression).map((match) => ({
    argument: match.match[2],
    line: getLineNumber(source, match.index),
  }));
}

function findMatches(source, expression) {
  const matches = [];
  expression.lastIndex = 0;
  let match = expression.exec(source);
  while (match !== null) {
    matches.push({ index: match.index, match });
    match = expression.exec(source);
  }
  return matches;
}

function printSummary(routeInventory, hardFailures, migrationInventory) {
  console.log('[workspace-audit] Workspace route inventory');
  console.log(`- routes.json files: ${routeInventory.routesFiles.length}`);
  console.log(`- legacy workspaces: ${routeInventory.legacyWorkspaces.length}`);
  console.log(`- workspace2 registrations: ${routeInventory.workspace2s.length}`);
  console.log(`- workspaceWindow2 registrations: ${routeInventory.workspaceWindows2.length}`);
  console.log(`- legacy workspaceGroups: ${routeInventory.legacyWorkspaceGroups.length}`);
  console.log(`- workspaceGroup2 registrations: ${routeInventory.workspaceGroups2.length}`);

  if (hardFailures.length === 0) {
    console.log('\n[workspace-audit] Hard checks passed.');
  } else {
    console.log(`\n[workspace-audit] Hard checks failed: ${hardFailures.length}`);
    printFailures(hardFailures);
  }

  console.log('\n[workspace-audit] Migration inventory');
  printDefinitionSummary('Legacy workspace registrations', migrationInventory.legacyWorkspaceFiles);
  printDefinitionSummary('Legacy workspace group registrations', migrationInventory.legacyWorkspaceGroupFiles);
  printReferenceSummary('WorkspaceContainer references', migrationInventory.workspaceContainerReferences);
  printReferenceSummary('ActionMenuButton references', migrationInventory.actionMenuButtonReferences);
  printReferenceSummary(
    'launchWorkspace / launchWorkspaceGroup references',
    migrationInventory.launchWorkspaceReferences,
  );
  printReferenceSummary('promptBeforeClosing references', migrationInventory.promptBeforeClosingReferences);
  printReferenceSummary('dynamic launchWorkspace2 references', migrationInventory.dynamicLaunchWorkspace2References);

  if (reportOnly) {
    console.log('\n[workspace-audit] Report-only mode enabled. Exit code forced to 0.');
  }
}

function printFailures(failures) {
  const visible = failures.slice(0, hardLimit);
  for (const failure of visible) {
    console.log(`- ${failure.message}`);
    for (const location of failure.locations) {
      console.log(`  ${location}`);
    }
    if (failure.details) {
      console.log(`  ${failure.details}`);
    }
  }

  if (failures.length > visible.length) {
    console.log(`- ... ${failures.length - visible.length} more hard failure(s) omitted`);
  }
}

function printDefinitionSummary(label, items) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  console.log(`\n${label}: ${total}`);
  for (const item of items.slice(0, inventoryLimit)) {
    console.log(`- ${item.filePath}: ${item.count}`);
  }
  if (items.length > inventoryLimit) {
    console.log(`- ... ${items.length - inventoryLimit} more file(s) omitted`);
  }
}

function printReferenceSummary(label, references) {
  console.log(`\n${label}: ${references.length}`);
  for (const reference of references.slice(0, inventoryLimit)) {
    console.log(`- ${reference.filePath}:${reference.line}`);
  }
  if (references.length > inventoryLimit) {
    console.log(`- ... ${references.length - inventoryLimit} more reference(s) omitted`);
  }
}

function joinLocations(definitions) {
  return [...new Set(definitions.map((definition) => definition.filePath))].join(', ');
}

function getLineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

function compareReferences(left, right) {
  const fileCompare = left.filePath.localeCompare(right.filePath);
  if (fileCompare !== 0) {
    return fileCompare;
  }
  return left.line - right.line;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRelativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

main();
