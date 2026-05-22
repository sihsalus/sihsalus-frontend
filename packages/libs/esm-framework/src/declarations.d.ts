declare type SideNavProps = {
  isChildOfHeader?: boolean;
};
declare module '*.css';
declare module '*.scss';
declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.png';

declare module 'geopattern' {
  const geopattern: {
    generate: (value: string) => {
      toDataUrl: () => string;
    };
  };

  export = geopattern;
}
