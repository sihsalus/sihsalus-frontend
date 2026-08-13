import path from 'node:path';
function normalizeReplacement(rootDir, replacement, isGlob) {
    const isPathLike = replacement.startsWith('.') || replacement.startsWith('/');
    if (!isPathLike) {
        return replacement;
    }
    return isGlob
        ? `${path.resolve(rootDir, replacement.slice(0, -2)).split(path.sep).join('/')}/$1`
        : path.resolve(rootDir, replacement).split(path.sep).join('/');
}
export function createVitestAliases(rootDir, aliases) {
    return Object.entries(aliases).map(([key, relativeTarget]) => {
        const isGlob = key.endsWith('/*');
        const find = isGlob ? new RegExp(`^${key.slice(0, -2)}/(.*)$`) : new RegExp(`^${key}$`);
        const replacement = normalizeReplacement(rootDir, relativeTarget, isGlob);
        return { find, replacement };
    });
}
//# sourceMappingURL=vitest-aliases.js.map