/// <reference types="vitest/globals" />

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Vitest 5 no longer inherits DOM matchers from the global Jest namespace.
declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}

declare module "*.scss" {
  const styles: { [className: string]: string };
  export default styles;
}

declare module "*.css" {
  const styles: { [className: string]: string };
  export default styles;
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare const require: NodeJS.Require;

declare namespace NodeJS {
  interface Require {
    (moduleName: string): any;
    context(
      directory: string,
      useSubdirectories?: boolean,
      regExp?: RegExp,
      mode?: string,
    ): any;
  }
}

declare global {
  var spaBase: string;
  function getOpenmrsSpaBase(): string;
}

export {};
