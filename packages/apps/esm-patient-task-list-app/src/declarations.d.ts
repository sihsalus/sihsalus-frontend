declare module '*.css';
declare module '*.scss';
declare module '*.png';

declare const require: NodeJS.Require;

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): unknown;
  }
}
