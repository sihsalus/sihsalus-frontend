import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fuaReadPrivilege } from './constant';
import { LinkExtension } from './left-panel-link.component';

type UserHasAccessProps = {
  privilege: string | string[];
  fallback?: ReactNode;
  children?: ReactNode;
};

type ConfigurableLinkProps = {
  to: string;
  className?: string;
  children?: ReactNode;
};

const mockUserHasAccess = vi.hoisted(() => vi.fn((_props: UserHasAccessProps): ReactNode => null));

vi.mock('@openmrs/esm-framework', async () => {
  const React = await import('react');

  return {
    ConfigurableLink: ({ to, className, children }: ConfigurableLinkProps) =>
      React.createElement('a', { href: to, className }, children),
    UserHasAccess: (props: UserHasAccessProps) => mockUserHasAccess(props),
  };
});

// constant.ts importa estos UUID desde la lib; el stub evita cargar la lib real,
// cuyo grafo de módulos necesita más exports del framework que este mock cerrado.
vi.mock('@openmrs/esm-patient-common-lib', () => ({
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID: '9b3df0a1-0c58-4f55-9868-9c38f1db2051',
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID: '9b3df0a1-0c58-4f55-9868-9c38f1db2052',
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID: '9b3df0a1-0c58-4f55-9868-9c38f1db2053',
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID: '9b3df0a1-0c58-4f55-9868-9c38f1db2054',
}));

describe('LinkExtension', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'getOpenmrsSpaBase',
      vi.fn(() => '/openmrs/spa/'),
    );
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects the FUA side-nav link with the read privilege', () => {
    render(
      <BrowserRouter>
        <LinkExtension config={{ name: 'fua', title: 'FUA' }} />
      </BrowserRouter>,
    );

    expect(mockUserHasAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: fuaReadPrivilege,
        children: expect.anything(),
      }),
    );
    expect(screen.getByRole('link', { name: 'FUA' })).toHaveAttribute('href', '/openmrs/spa/home/fua');
  });

  it('does not render the link when UserHasAccess denies access', () => {
    mockUserHasAccess.mockImplementation(() => null);

    render(
      <BrowserRouter>
        <LinkExtension config={{ name: 'fua', title: 'FUA' }} />
      </BrowserRouter>,
    );

    expect(screen.queryByRole('link', { name: 'FUA' })).not.toBeInTheDocument();
  });
});
