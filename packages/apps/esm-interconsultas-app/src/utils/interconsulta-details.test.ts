import {
  buildInterconsultaInstructions,
  getInterconsultaDestinationDisplay,
  getInterconsultaReason,
  parseInterconsultaInstructions,
} from './interconsulta-details';

describe('interconsultation instruction details', () => {
  it('keeps local interconsultation instructions unchanged', () => {
    expect(buildInterconsultaInstructions('Evaluación por dolor persistente')).toBe('Evaluación por dolor persistente');
    expect(parseInterconsultaInstructions('Evaluación por dolor persistente')).toEqual({
      externalDestination: null,
      reason: 'Evaluación por dolor persistente',
    });
  });

  it('round trips an external specialist without turning it into a referral', () => {
    const instructions = buildInterconsultaInstructions('Evaluar conducta terapéutica', 'Cardiología remota');

    expect(instructions).toBe('Destino externo/remoto: Cardiología remota\nMotivo: Evaluar conducta terapéutica');
    expect(parseInterconsultaInstructions(instructions)).toEqual({
      externalDestination: 'Cardiología remota',
      reason: 'Evaluar conducta terapéutica',
    });
  });

  it('uses the external destination in interconsultation views', () => {
    const order = {
      concept: { uuid: 'other-concept', display: 'Otro no codificado' },
      instructions: 'Destino externo/remoto: Neurología\nMotivo: Segunda opinión',
    };

    expect(getInterconsultaDestinationDisplay(order)).toBe('Neurología');
    expect(getInterconsultaReason(order)).toBe('Segunda opinión');
  });
});
