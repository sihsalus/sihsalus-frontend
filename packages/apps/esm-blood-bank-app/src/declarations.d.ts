declare module '*.scss' {
  const styles: Record<string, string>;
  export default styles;
}
declare module '*.css';

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): unknown;
  }
}
