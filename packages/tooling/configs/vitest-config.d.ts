import aliasPresets from './alias-presets.json';
type TestOptions = {
    setupFiles?: string | string[];
    [key: string]: unknown;
};
type AliasMap = Record<string, string>;
type VitestConfigLike = {
    resolve?: {
        alias?: Array<{
            find: RegExp;
            replacement: string;
        }>;
    };
    test?: TestOptions;
    [key: string]: unknown;
};
export declare function defineWorkspaceVitestConfig(config?: VitestConfigLike): UserConfig;
export { aliasPresets };
export declare function defineAppVitestConfig(rootDir: string, options?: {
    aliases?: AliasMap;
    extraAliases?: Array<{
        find: RegExp;
        replacement: string;
    }>;
    test?: VitestConfigLike['test'];
}): UserConfig;
export declare function defineWorkspaceVitestConfigWithSetup(config?: VitestConfigLike): UserConfig;
//# sourceMappingURL=vitest-config.d.ts.map