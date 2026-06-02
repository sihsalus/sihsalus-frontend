import { getIndicadorById, resolveOrdenesMock, updateIndicadorMock } from './indicators-data';

describe('resolveOrdenesMock', () => {
  it('returns correct Record for known UUIDs', () => {
    const result = resolveOrdenesMock(['ord-hemograma', 'ord-ferritina', 'ord-fluor']);

    expect(result).toEqual({
      'ord-hemograma': 'Hemograma',
      'ord-ferritina': 'Ferritina sérica',
      'ord-fluor': 'Aplicación de flúor',
    });
  });

  it('returns empty Record for empty input', () => {
    const result = resolveOrdenesMock([]);

    expect(result).toEqual({});
  });

  it('excludes unknown UUIDs from result (partial resolution)', () => {
    const result = resolveOrdenesMock(['ord-hemograma', 'ord-unknown', 'ord-fluor']);

    expect(result).toEqual({
      'ord-hemograma': 'Hemograma',
      'ord-fluor': 'Aplicación de flúor',
    });
    expect(result['ord-unknown']).toBeUndefined();
  });
});

describe('updateIndicadorMock', () => {
  const existingId = 'ind-001';

  it('updates nombre and descripcion as before', () => {
    const result = updateIndicadorMock(existingId, {
      nombre: 'Nombre actualizado',
      descripcion: 'Desc actualizada',
    });

    expect(result.nombre).toBe('Nombre actualizado');
    expect(result.descripcion).toBe('Desc actualizada');
    // Verify the in-memory data was persisted
    const persisted = getIndicadorById(existingId);
    expect(persisted.nombre).toBe('Nombre actualizado');
    expect(persisted.descripcion).toBe('Desc actualizada');
  });

  it('updates activo to false when provided in payload', () => {
    const result = updateIndicadorMock(existingId, {
      nombre: 'Nombre activo false',
      descripcion: null,
      activo: false,
    });

    expect(result.activo).toBe(false);
    const persisted = getIndicadorById(existingId);
    expect(persisted.activo).toBe(false);
  });

  it('updates activo to true when provided in payload', () => {
    const result = updateIndicadorMock(existingId, {
      nombre: 'Nombre activo true',
      descripcion: null,
      activo: true,
    });

    expect(result.activo).toBe(true);
    const persisted = getIndicadorById(existingId);
    expect(persisted.activo).toBe(true);
  });

  it('does not change activo when not provided in payload', () => {
    // First, set a known state
    updateIndicadorMock(existingId, {
      nombre: 'Previo',
      descripcion: null,
      activo: true,
    });

    // Then update without activo
    const result = updateIndicadorMock(existingId, {
      nombre: 'Sin activo',
      descripcion: null,
    });

    expect(result.activo).toBe(true);
  });

  it('throws when id does not exist', () => {
    expect(() =>
      updateIndicadorMock('non-existent-id', {
        nombre: 'X',
        descripcion: null,
        activo: false,
      }),
    ).toThrow('Indicador no encontrado');
  });
});
