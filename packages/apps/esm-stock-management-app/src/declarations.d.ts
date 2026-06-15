declare module '*.css';
declare module '*.scss';
declare module '*.png';

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
