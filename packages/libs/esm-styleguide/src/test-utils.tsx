import { type RenderOptions, render } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { SWRConfig } from 'swr';

export const swrWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 0,
        provider: () => new Map(),
      }}
    >
      {children}
    </SWRConfig>
  );
};

export const renderWithSwr = (ui: ReactElement, options?: Omit<RenderOptions, 'queries'>) =>
  render(ui, { wrapper: swrWrapper, ...options });
