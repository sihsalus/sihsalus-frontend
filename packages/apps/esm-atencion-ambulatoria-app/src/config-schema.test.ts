import { configSchema } from './config-schema';

describe('Atencion Ambulatoria configuration', () => {
  it.each([
    ['consultaExternaForm', 'CE-001-CONSULTA EXTERNA'],
    ['anamnesisForm', 'CE-ANAM-001-ANAMNESIS'],
    ['soapNoteForm', 'CE-SOAP-001-NOTA SOAP'],
    ['referralForm', 'CE-REF-001-REFERENCIA-CONTRARREFERENCIA'],
  ] as const)('identifies %s by its stable published name', (configKey, publishedName) => {
    expect(configSchema.formsList._default[configKey]).toBe(publishedName);
  });
});
