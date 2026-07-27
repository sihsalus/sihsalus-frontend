import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

export default function renderWithRouter<T = unknown>(
  Component: React.JSXElementConstructor<T>,
  props: T = {} as unknown as T,
  { route = '/', routes = [route], routeParams: _routeParams = {} } = {},
) {
  return {
    ...render(
      <MemoryRouter initialEntries={routes} initialIndex={(route && routes?.indexOf(route)) || undefined}>
        <Component {...props} />
      </MemoryRouter>,
    ),
  };
}
