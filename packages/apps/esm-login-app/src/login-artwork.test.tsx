import { render } from '@testing-library/react';

import { LoginArtwork } from './login-artwork.component';

describe('LoginArtwork', () => {
  it('renders the optimized AVIF source and PNG fallback from the SPA base', () => {
    const { container } = render(<LoginArtwork className="picture" imageClassName="image" />);
    const picture = container.querySelector('picture');
    const optimizedSource = container.querySelector('source[type="image/avif"]');
    const fallbackImage = container.querySelector('img');

    expect(picture).toHaveClass('picture');
    expect(optimizedSource).toHaveAttribute('srcset', '/openmrs/spa/login.avif');
    expect(fallbackImage).toHaveClass('image');
    expect(fallbackImage).toHaveAttribute('src', '/openmrs/spa/login.png');
    expect(fallbackImage).toHaveAttribute('alt', '');
    expect(fallbackImage).toHaveAttribute('width', '1672');
    expect(fallbackImage).toHaveAttribute('height', '941');
  });
});
