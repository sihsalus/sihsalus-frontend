declare module '*.scss' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module '*.png' {
  const value: string;
  export default value;
}


declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
