declare module '*.css' {
  interface Styles {
    [key: string]: string;
  }
  const content: Styles;
  export default content;
}
declare module '*.scss' {
  interface Styles {
    [key: string]: string;
  }
  const content: Styles;
  export default content;
}
declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.png';
declare module 'geopattern' {
  interface GeoPatternInstance {
    toDataUrl: () => string;
  }

  interface GeoPatternStatic {
    generate: (seed: string) => GeoPatternInstance;
  }

  const geopattern: GeoPatternStatic;
  export = geopattern;
}
