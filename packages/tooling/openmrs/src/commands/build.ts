import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, parse, resolve } from 'node:path';

import { checkImportmapJson, checkRoutesJson, getImportMap, getRoutes, logInfo, rspackBin, shellDir } from '../utils';
import { setShellEnvVars } from '../utils/config';

export interface BuildArgs {
  target: string;
  registry: string;
  defaultLocale: string;
  importmap?: string;
  routes?: string;
  spaPath: string;
  fresh?: boolean;
  apiUrl: string;
  pageTitle: string;
  supportOffline?: boolean;
  configUrls: Array<string>;
  configPaths: Array<string>;
  buildConfig?: string;
  env: string;
  assets: Array<string>;
}

export type BuildConfig = Partial<{
  apiUrl: string;
  configUrls: Array<string>;
  configPaths: Array<string>;
  defaultLocale: string;
  pageTitle: string;
  supportOffline: boolean;
  importmap: string;
  routes: string;
  spaPath: string;
  env: string;
  assets: Array<string>;
}>;

function loadBuildConfig(buildConfigPath?: string): BuildConfig {
  if (buildConfigPath) {
    return JSON.parse(readFileSync(buildConfigPath, 'utf8'));
  } else {
    return {} as BuildConfig;
  }
}

function addConfigFilesFromPaths(configPaths: Array<string>, targetDir: string) {
  for (const configPath of configPaths) {
    const realPath = resolve(configPath);
    copyFileSync(realPath, join(targetDir, basename(configPath)));
  }
}

export async function runBuild(args: BuildArgs) {
  const buildConfig = loadBuildConfig(args.buildConfig);
  const configUrls = buildConfig.configUrls || args.configUrls;
  for (const configPath of buildConfig.configPaths || args.configPaths) {
    configUrls.push(basename(configPath));
  }

  const importMap = await getImportMap(args.importmap || buildConfig.importmap || 'importmap.json');
  // if we're supplying a URL importmap and the dist folder exists and the raw importmap file doesn't exist
  // we use the nearest thing. Basically, this is added to support the --hash-importmap assemble option.
  if (importMap.type === 'url') {
    if (
      !/^https?:\/\//.test(importMap.value) &&
      existsSync(args.target) &&
      !existsSync(resolve(args.target, basename(importMap.value)))
    ) {
      const { name: fileName, ext: extension } = parse(importMap.value);
      const paths = readdirSync(args.target).filter(
        (entry) =>
          entry.startsWith(fileName) &&
          entry.endsWith(extension) &&
          statSync(resolve(args.target, entry)).isFile() &&
          checkImportmapJson(readFileSync(resolve(args.target, entry)).toString()),
      );

      if (paths.length > 0 && paths[0]) {
        importMap.value = importMap.value.replace(/importmap\.json/i, paths[0]);
      }
    }
  }

  const routes = await getRoutes(args.routes || buildConfig.routes || 'routes.registry.json');
  // As above, check for a hashed routes.registry.json if --hash-importmap assmeble option was used
  if (routes.type === 'url') {
    if (
      !/^https?:\/\//.test(routes.value) &&
      existsSync(args.target) &&
      !existsSync(resolve(args.target, routes.value))
    ) {
      const { name: fileName, ext: extension } = parse(routes.value);
      const paths = readdirSync(args.target).filter(
        (entry) =>
          entry.startsWith(fileName) &&
          entry.endsWith(extension) &&
          statSync(resolve(args.target, entry)).isFile() &&
          checkRoutesJson(readFileSync(resolve(args.target, entry)).toString()),
      );

      if (paths.length > 0 && paths[0]) {
        routes.value = routes.value.replace(/routes\.registry\.json/i, paths[0]);
      }
    }
  }

  setShellEnvVars({
    importmap: importMap,
    routes,
    env: buildConfig.env || args.env,
    apiUrl: buildConfig.apiUrl || args.apiUrl,
    configUrls: configUrls,
    defaultLocale: args.defaultLocale || buildConfig.defaultLocale,
    pageTitle: buildConfig.pageTitle || args.pageTitle,
    supportOffline: buildConfig.supportOffline ?? args.supportOffline,
    spaPath: buildConfig.spaPath || args.spaPath,
    fresh: args.fresh ?? false,
    assets: args.assets || buildConfig.assets || [],
  });

  logInfo(`Running build process ...`);

  const mode = (buildConfig.env || args.env) === 'development' ? 'development' : 'production';

  await new Promise<void>((res, rej) => {
    const ps = spawn(process.execPath, [rspackBin, 'build', '--mode', mode, '--output-path', args.target], {
      cwd: shellDir,
      stdio: 'inherit',
    });
    ps.on('error', rej);
    ps.on('exit', (code) => (code === 0 ? res() : rej(new Error(`rspack exited with code ${code}`))));
  });

  addConfigFilesFromPaths(buildConfig.configPaths || args.configPaths, args.target);

  logInfo(`Build finished.`);
}
