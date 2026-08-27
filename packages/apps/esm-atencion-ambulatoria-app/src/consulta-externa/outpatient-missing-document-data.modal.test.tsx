import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import OutpatientMissingDocumentDataModal from './outpatient-missing-document-data.modal';

describe('OutpatientMissingDocumentDataModal', () => {
  it('names every pending datum and the tab that owns it', () => {
    render(
      <OutpatientMissingDocumentDataModal
        closeModal={vi.fn()}
        requirements={[
          { id: 'followUpDate', tab: 'treatment' },
          { id: 'primaryDiagnosisCie10', tab: 'diagnosis' },
        ]}
        title="No se pudo generar el PDF de indicaciones"
      />,
    );

    expect(screen.getByText('No se pudo generar el PDF de indicaciones')).toBeInTheDocument();
    expect(screen.getByText('Faltan estos datos en la atención:')).toBeInTheDocument();
    expect(screen.getByText('Fecha de control')).toBeInTheDocument();
    expect(screen.getByText('→ Plan de Tratamiento')).toBeInTheDocument();
    expect(screen.getByText('Código CIE-10 en el diagnóstico principal')).toBeInTheDocument();
    expect(screen.getByText('→ Diagnóstico')).toBeInTheDocument();
  });

  it('sends the clinician to the first tab that can fix the document', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    const onNavigateToTab = vi.fn();
    render(
      <OutpatientMissingDocumentDataModal
        closeModal={closeModal}
        onNavigateToTab={onNavigateToTab}
        requirements={[
          { id: 'ambiguousClinicalEncounter' },
          { id: 'primaryDiagnosisCie10', tab: 'diagnosis' },
          { id: 'followUpDate', tab: 'treatment' },
        ]}
        title="No se pudo emitir la Receta Única"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ir a Diagnóstico' }));

    expect(onNavigateToTab).toHaveBeenCalledWith('diagnosis');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('offers no shortcut when nothing pending is registered from this dashboard', () => {
    render(
      <OutpatientMissingDocumentDataModal
        closeModal={vi.fn()}
        onNavigateToTab={vi.fn()}
        requirements={[{ id: 'ambiguousClinicalEncounter' }]}
        title="No se pudo emitir la Receta Única"
      />,
    );

    expect(screen.queryByRole('button', { name: /^Ir a / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('explains a blocked document that has no pending data to list', () => {
    render(
      <OutpatientMissingDocumentDataModal
        closeModal={vi.fn()}
        description="El servidor no entregó la numeración."
        requirements={[]}
        title="No se pudo emitir la Receta Única"
      />,
    );

    expect(screen.getByText('El servidor no entregó la numeración.')).toBeInTheDocument();
    expect(screen.queryByText('Faltan estos datos en la atención:')).not.toBeInTheDocument();
  });
});
