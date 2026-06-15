/// <reference path="../packages/declarations.d.ts" />

// This file is intentionally minimal: many package tsconfigs include
// '../../tools/setup-tests.ts' to pick up test-related ambient types.
// We reference `packages/declarations.d.ts` here so those packages see
// the global `vi` and related shims during TypeScript checks.

export {};
