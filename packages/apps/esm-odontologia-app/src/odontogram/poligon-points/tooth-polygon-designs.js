export const getPolygonPoints = (zones) => {
  const zoneSchemes = {
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
