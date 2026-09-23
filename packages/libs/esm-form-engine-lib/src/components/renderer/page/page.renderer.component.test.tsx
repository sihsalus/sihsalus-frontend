import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { FormPage, FormSection } from '../../../types';
import PageRenderer from './page.renderer.component';

vi.mock('@openmrs/esm-framework/src/internal', () => ({ ChevronDownIcon: () => null, ChevronUpIcon: () => null }));
vi.mock('react-waypoint', () => ({ Waypoint: ({ children }: { children: ReactNode }) => children }));
vi.mock('../section/section-renderer.component', () => ({
  SectionRenderer: ({ section }: { section: FormSection }) => <input aria-label={`Dato ${section.label}`} />,
}));

const page: FormPage = {
  label: 'Anamnesis',
  id: 'anamnesis',
  sections: [
    {
      label: 'Enfermedad actual',
      isExpanded: 'true',
      questions: [{ id: 'illness', type: 'control', questionOptions: { rendering: 'text' } }],
    },
    {
      label: 'Funciones biológicas',
      isExpanded: 'false',
      questions: [{ id: 'functions', type: 'control', questionOptions: { rendering: 'text' } }],
    },
  ],
};

it('honors the initial collapsed section and retains its value across manual toggles', async () => {
  render(<PageRenderer page={page} isFormExpanded isPreview />);
  const user = userEvent.setup();
  expect(screen.getByRole('button', { name: 'Enfermedad actual' })).toHaveAttribute('aria-expanded', 'true');
  const functions = screen.getByRole('button', { name: 'Funciones biológicas' });
  expect(functions).toHaveAttribute('aria-expanded', 'false');
  await user.click(functions);
  await user.type(screen.getByLabelText('Dato Funciones biológicas'), 'Valor sintético');
  await user.click(functions);
  await user.click(functions);
  expect(screen.getByLabelText('Dato Funciones biológicas')).toHaveValue('Valor sintético');
});

it('lets subsequent expand-all actions open a section initially collapsed by the schema', () => {
  const { rerender } = render(<PageRenderer page={page} isFormExpanded isPreview />);
  rerender(<PageRenderer page={page} isFormExpanded={false} isPreview />);
  rerender(<PageRenderer page={page} isFormExpanded isPreview />);
  expect(screen.getByRole('button', { name: 'Funciones biológicas' })).toHaveAttribute('aria-expanded', 'true');
});
