declare module '*.scss' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module 'react-barcode' {
  import type { ComponentType } from 'react';

  export interface Options {
    width?: number;
    format?: string;
    background?: string;
    displayValue?: boolean;
    renderer?: 'svg' | 'canvas' | 'img';
    font?: string;
    textAlign?: 'left' | 'center' | 'right';
    textPosition?: 'top' | 'bottom';
    fontSize?: number;
    [key: string]: unknown;
  }

  export type BarcodeProps = Options & {
    value?: string;
  };

  const Barcode: ComponentType<BarcodeProps>;
  export default Barcode;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): any;
  }
}
