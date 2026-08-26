import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchProviderCollegiateNumber, generateRecetaUnicaNumber } from './receta-unica.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function idgenResponse(identifier: string | undefined, serverDate: string | null) {
  return {
    data: identifier === undefined ? {} : { identifier },
    headers: { get: (name: string) => (name === 'date' ? serverDate : null) },
  } as unknown as Awaited<ReturnType<typeof openmrsFetch>>;
}

describe('generateRecetaUnicaNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emite el correlativo con la fecha DEL SERVIDOR y calcula la vigencia', async () => {
    mockOpenmrsFetch.mockResolvedValue(idgenResponse('RU-000123', 'Tue, 26 Aug 2026 14:00:00 GMT'));

    const emission = await generateRecetaUnicaNumber('source-uuid', 'receta-unica visita:v paciente:p', 3);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/idgen/identifiersource/source-uuid/identifier',
      expect.objectContaining({
        method: 'POST',
        // El comentario alimenta el log de emisión de idgen: la auditoría.
        body: { comment: 'receta-unica visita:v paciente:p' },
      }),
    );
    expect(emission.number).toBe('RU-000123');
    expect(emission.issuedAt).toBe('2026-08-26T14:00:00.000Z');
    expect(emission.validUntil).toBe('2026-08-29T14:00:00.000Z');
  });

  it('falla cerrado cuando la fuente no entrega correlativo', async () => {
    mockOpenmrsFetch.mockResolvedValue(idgenResponse(undefined, 'Tue, 26 Aug 2026 14:00:00 GMT'));
    await expect(generateRecetaUnicaNumber('source-uuid', 'c', 3)).rejects.toThrow(
      'La fuente de numeración no entregó un correlativo.',
    );
  });

  it('falla cerrado sin fecha del servidor: no se imprime con el reloj del navegador', async () => {
    mockOpenmrsFetch.mockResolvedValue(idgenResponse('RU-1', null));
    await expect(generateRecetaUnicaNumber('source-uuid', 'c', 3)).rejects.toThrow(
      'La respuesta del servidor no incluyó una fecha de emisión.',
    );
  });
});

describe('fetchProviderCollegiateNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la colegiatura del attribute type configurado, ignorando anulados', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        attributes: [
          { voided: true, value: 'CMP 000', attributeType: { uuid: 'colegiatura-type' } },
          { voided: false, value: ' CMP 12345 ', attributeType: { uuid: 'colegiatura-type' } },
          { voided: false, value: 'otro', attributeType: { uuid: 'otro-type' } },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchProviderCollegiateNumber('provider-uuid', 'colegiatura-type')).resolves.toBe('CMP 12345');
  });

  it('devuelve null sin provider, sin tipo o sin atributo: la línea queda manuscrita', async () => {
    await expect(fetchProviderCollegiateNumber('', 'colegiatura-type')).resolves.toBeNull();
    await expect(fetchProviderCollegiateNumber('provider-uuid', '')).resolves.toBeNull();
    mockOpenmrsFetch.mockResolvedValue({ data: { attributes: [] } } as unknown as Awaited<
      ReturnType<typeof openmrsFetch>
    >);
    await expect(fetchProviderCollegiateNumber('provider-uuid', 'colegiatura-type')).resolves.toBeNull();
  });
});
