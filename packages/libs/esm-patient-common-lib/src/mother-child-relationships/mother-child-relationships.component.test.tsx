import { render, screen } from '@testing-library/react';
import React from 'react';

import { MotherChildRelationships } from './mother-child-relationships.component';
import { type MotherAndChildLink, useMotherAndChildLinks } from './mother-child-relationships.resource';

vi.mock('./mother-child-relationships.resource', () => ({ useMotherAndChildLinks: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name: string }) => (options ? `${key} ${options.name}` : key),
  }),
}));
const reader = vi.mocked(useMotherAndChildLinks);
const family = {
  mother: { uuid: 'synthetic-mother', display: 'Madre Sintética' },
  child: { uuid: 'synthetic-child', display: 'Niño Sintético' },
};
const props = {
  patientUuid: family.mother.uuid,
  patientRole: 'mother' as const,
  canView: true,
  translationNamespace: 'test',
};
function state(data: MotherAndChildLink[] | undefined, error?: Error, isLoading = false) {
  return { data, error, isLoading } as ReturnType<typeof useMotherAndChildLinks>;
}
beforeEach(() => {
  vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa/');
  reader.mockReturnValue(state([family]));
});

it.each([
  ['mother', family.mother.uuid, family.child],
  ['child', family.child.uuid, family.mother],
] as const)(
  'opens the opposite patient’s native chart for a %s, using their own name and UUID',
  (patientRole, patientUuid, relative) => {
    render(<MotherChildRelationships {...props} patientRole={patientRole} patientUuid={patientUuid} />);
    const link = screen.getByRole('link', { name: `motherChildOpenChart ${relative.display}` });
    expect(link).toHaveTextContent(relative.display);
    expect(link).toHaveAttribute('href', `${window.getOpenmrsSpaBase()}patient/${relative.uuid}/chart`);
    expect(reader).toHaveBeenCalledWith(
      patientRole === 'mother' ? { motherUuid: patientUuid } : { childUuid: patientUuid },
      true,
    );
  },
);

it('does not mount a reader without the owning permission, and removes links when it is revoked', () => {
  const { rerender } = render(<MotherChildRelationships {...props} canView={false} />);
  expect(reader).not.toHaveBeenCalled();
  rerender(<MotherChildRelationships {...props} />);
  expect(screen.getByRole('link')).toBeInTheDocument();
  rerender(<MotherChildRelationships {...props} canView={false} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('shows only a confirmed empty result as an absent registered relationship', () => {
  reader.mockReturnValue(state(undefined, undefined, true));
  const { rerender } = render(<MotherChildRelationships {...props} />);
  expect(screen.queryByText('motherChildNoLinkedChildren')).not.toBeInTheDocument();
  reader.mockReturnValue(state([]));
  rerender(<MotherChildRelationships {...props} />);
  expect(screen.getByText('motherChildNoLinkedChildren')).toBeInTheDocument();
});

it('shows a failed lookup without saying the patient has no mother or children', () => {
  reader.mockReturnValue(state(undefined, new Error('synthetic configuration failure')));
  render(<MotherChildRelationships {...props} patientRole="child" patientUuid={family.child.uuid} />);
  expect(screen.getByText('motherChildRelationshipError')).toBeInTheDocument();
  expect(screen.queryByText('motherChildNoLinkedMother')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it.each([
  { data: [{ ...family, mother: { uuid: 'synthetic-other-mother' } }] },
  { data: [{ ...family, child: { uuid: family.mother.uuid } }] },
])('does not show another patient’s or a self-referencing relationship: %j', ({ data }) => {
  reader.mockReturnValue(state(data));
  render(<MotherChildRelationships {...props} />);
  expect(screen.getByText('motherChildRelationshipError')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('motherChildNoLinkedChildren')).not.toBeInTheDocument();
});

it('clears the first patient’s name and link when the patient changes', () => {
  const { rerender } = render(<MotherChildRelationships {...props} />);
  reader.mockReturnValue(state(undefined, undefined, true));
  rerender(<MotherChildRelationships {...props} patientUuid="synthetic-next-mother" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText(family.child.display)).not.toBeInTheDocument();
  expect(reader).toHaveBeenLastCalledWith({ motherUuid: 'synthetic-next-mother' }, true);
});
