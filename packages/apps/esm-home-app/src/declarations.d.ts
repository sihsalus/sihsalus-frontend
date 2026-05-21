declare module '*.scss' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
