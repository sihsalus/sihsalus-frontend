import { render, screen } from '@testing-library/react';

import VisitFormQueueFields from './visit-form-queue-fields.extension';

vi.mock('./queue-fields.component', () => ({
  default: () => {
    throw new Error('Queue configuration failed');
  },
}));

describe('VisitFormQueueFields', () => {
  it('shows a contextual and actionable error when the appointment queue fields fail', () => {
    render(
      <VisitFormQueueFields
        patientUuid="patient-uuid"
        setVisitFormCallbacks={vi.fn()}
        visitFormOpenedFrom="appointments-check-in"
      />,
    );

    expect(
      screen.getByText(/No se pudo cargar la información de la cola|The queue information could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/vuelva a registrar la llegada|check in the appointment again/i)).toBeInTheDocument();
  });
});
