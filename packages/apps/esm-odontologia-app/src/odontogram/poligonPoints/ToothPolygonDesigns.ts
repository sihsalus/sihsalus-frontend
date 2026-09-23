// The six central areas of a lower second primary molar. Numbers are persisted
// finding design IDs: append new IDs, never reassign existing geometry.
export const PRIMARY_MOLAR_SURFACES: Record<number, string> = {
  15: '5,5 8.333333,5 8.333333,10 5,10',
  16: '8.333333,5 11.666667,5 11.666667,10 8.333333,10',
  17: '11.666667,5 15,5 15,10 11.666667,10',
  18: '5,10 8.333333,10 8.333333,15 5,15',
  19: '8.333333,10 11.666667,10 11.666667,15 8.333333,15',
  20: '11.666667,10 15,10 15,15 11.666667,15',
};

export const getPolygonPoints = (zones: number): string[] => {
  const zoneSchemes: Record<number, string[]> = {
    4: [
      '0,0 20,0 15,10 5,10', // Top
      '0,0 5,10 0,20', // Left
      '20,0 20,20 15,10', // Right
      '0,20 5,10 15,10 20,20', // Bottom
    ],
    6: [
      '0,0 20,0 15,5 5,5', // Top
      '5,15 15,15 20,20 0,20', // Bottom
      '0,0 5,5 5,15 0,20', // Left
      '15,5 20,0 20,20 15,15', // Right
      '5,5 15,5 15,15 5,15', // Center Top
      '5,10 15,10 15,15 5,15', // Center Bottom
    ],
    7: [
      '0,0 20,0 15,5 5,5',
      '5,15 15,15 20,20 0,20',
      '0,0 5,5 5,15 0,20',
      '15,5 20,0 20,20 15,15',
      '5,5 10,5 10,10 5,10',
      '10,5 15,5 15,10 10,10',
      '5,10 15,10 15,15 5,15',
    ],
    10: [
      '0,0 20,0 15,5 5,5',
      '5,15 15,15 20,20 0,20',
      '0,0 5,5 5,15 0,20',
      '15,5 20,0 20,20 15,15',
      ...Object.values(PRIMARY_MOLAR_SURFACES),
    ],
    8: [
      '0,0 20,0 15,5 5,5', // Top
      '5,15 15,15 20,20 0,20', // Bottom
      '0,0 5,5 5,15 0,20', // Left
      '15,5 20,0 20,20 15,15', // Right
      '5,5 10,5 10,10 5,10', // Top Center Right
      '10,5 15,5 15,10 10,10', // Top Center Left
      '5,10 10,10 10,15 5,15', // Bottom Center Right
      '10,10 15,10 15,15 10,15', // Bottom Center Left
    ],
  };

  return zoneSchemes[zones] || zoneSchemes[4]; // Por defecto, usar 4 zonas
};
