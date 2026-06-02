import { getIndicadorById, updateIndicadorMock } from './indicators-data';

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
