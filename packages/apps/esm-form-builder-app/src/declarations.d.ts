declare module '*.scss' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module 'geopattern' {
  const value: any;
  export default value;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
