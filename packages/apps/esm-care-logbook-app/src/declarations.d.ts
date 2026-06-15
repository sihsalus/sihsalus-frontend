declare module '*.scss';

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
