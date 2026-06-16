declare module '*.scss' {
  const styles: { readonly [className: string]: string };
  export default styles;
}

declare module '@sihsalus/esm-form-engine-lib' {
  export interface OpenmrsEncounter {
    [key: string]: unknown;
  }
}
