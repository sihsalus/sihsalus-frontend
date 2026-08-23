import {
  buildTipoDxObs,
  getCertaintyForTipo,
  parseTipoDxObs,
  TIPO_DX_FIELD_PREFIX,
  TIPO_DX_FORM_FIELD_NAMESPACE,
} from './visit-notes.resource';

const presuntivoUuid = 'tipo-presuntivo-uuid';
const definitivoUuid = 'tipo-definitivo-uuid';
const repetitivoUuid = 'tipo-repetitivo-uuid';
const diagnosisTypeConceptUuid = 'tipo-dx-concept-uuid';
const codedDiagnosisUuid = 'cie10-anemia-uuid';

describe('mapeo P/D/R del diagnóstico (NTS-139)', () => {
  describe('getCertaintyForTipo', () => {
    it('Definitivo → CONFIRMED', () => {
      expect(getCertaintyForTipo(definitivoUuid, definitivoUuid)).toBe('CONFIRMED');
    });

    it('Presuntivo y Repetitivo → PROVISIONAL', () => {
      expect(getCertaintyForTipo(presuntivoUuid, definitivoUuid)).toBe('PROVISIONAL');
      expect(getCertaintyForTipo(repetitivoUuid, definitivoUuid)).toBe('PROVISIONAL');
    });
  });

  describe('buildTipoDxObs', () => {
    it('construye el obs ligando el tipo al diagnóstico CIE-10', () => {
      expect(buildTipoDxObs(diagnosisTypeConceptUuid, codedDiagnosisUuid, repetitivoUuid)).toEqual({
        concept: { uuid: diagnosisTypeConceptUuid, display: '' },
        value: repetitivoUuid,
        formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
        formFieldPath: `${TIPO_DX_FIELD_PREFIX}${codedDiagnosisUuid}`,
      });
    });
  });

  describe('parseTipoDxObs', () => {
    it('reconstruye el mapa { conceptUuid → tipo } e ignora obs ajenos', () => {
      const obs = [
        buildTipoDxObs(diagnosisTypeConceptUuid, codedDiagnosisUuid, definitivoUuid),
        // obs de otro namespace / campo → debe ignorarse
        { formFieldNamespace: 'other', formFieldPath: `${TIPO_DX_FIELD_PREFIX}x`, value: { uuid: 'z' } },
        { formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE, formFieldPath: 'soap-plan', value: 'texto' },
      ];

      expect(parseTipoDxObs(obs)).toEqual({ [codedDiagnosisUuid]: definitivoUuid });
    });

    it('acepta value como string plano o como objeto coded', () => {
      const obs = [
        {
          formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
          formFieldPath: `${TIPO_DX_FIELD_PREFIX}a`,
          value: 'tipo-a',
        },
        {
          formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
          formFieldPath: `${TIPO_DX_FIELD_PREFIX}b`,
          value: { uuid: 'tipo-b' },
        },
      ];

      expect(parseTipoDxObs(obs)).toEqual({ a: 'tipo-a', b: 'tipo-b' });
    });

    it('es inverso de buildTipoDxObs', () => {
      const built = buildTipoDxObs(diagnosisTypeConceptUuid, codedDiagnosisUuid, presuntivoUuid);
      expect(parseTipoDxObs([built])).toEqual({ [codedDiagnosisUuid]: presuntivoUuid });
    });
  });
});
