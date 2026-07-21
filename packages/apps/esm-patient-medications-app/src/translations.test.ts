import spanishTranslations from '../translations/es.json';

describe('Spanish medication translations', () => {
  it('translates the free-text dosage toggle states', () => {
    expect(spanishTranslations.on).toBe('Activado');
    expect(spanishTranslations.off).toBe('Desactivado');
  });
});
