import { type ComponentPropsWithoutRef } from 'react';

interface LoginArtworkProps extends Omit<ComponentPropsWithoutRef<'picture'>, 'children'> {
  imageClassName?: string;
}

export function LoginArtwork({ imageClassName, ...pictureProps }: LoginArtworkProps) {
  const spaBase = globalThis.getOpenmrsSpaBase();

  return (
    <picture {...pictureProps}>
      <source srcSet={`${spaBase}login.avif`} type="image/avif" />
      <img className={imageClassName} src={`${spaBase}login.png`} alt="" width="1672" height="941" />
    </picture>
  );
}
