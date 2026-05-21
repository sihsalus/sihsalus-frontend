declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
