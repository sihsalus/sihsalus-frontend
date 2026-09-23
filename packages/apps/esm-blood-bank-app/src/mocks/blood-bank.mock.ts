import type { DashboardData, DonorSummary, InventorySummary } from '../types/blood-bank.types';

export const dashboardMock: DashboardData = {
  metrics: [
    { id: 'pending-applicants', labelKey: 'pendingApplicants', defaultLabel: 'Postulantes pendientes', value: 8 },
    { id: 'available-units', labelKey: 'availableUnits', defaultLabel: 'Unidades disponibles', value: 124 },
    { id: 'reserved-units', labelKey: 'reservedUnits', defaultLabel: 'Unidades reservadas', value: 9 },
    { id: 'daily-alerts', labelKey: 'dailyAlerts', defaultLabel: 'Alertas del día', value: 3 },
  ],
  workItems: [
    { id: 'POST-0001', section: 'Selección', description: 'Entrevista pendiente', status: 'Pendiente' },
    { id: 'DON-0002', section: 'Extracción', description: 'Donación de sangre total', status: 'En proceso' },
    { id: 'SOL-0003', section: 'Compatibilidad', description: 'Solicitud transfusional urgente', status: 'Alerta' },
  ],
};

export const donorsMock: DonorSummary[] = [
  {
    id: 'DON-0001',
    documentNumber: '70000001',
    fullName: 'Ana Torres García',
    bloodGroup: 'O+',
    lastDonationDate: '12/08/2026',
    status: 'Apto',
  },
  {
    id: 'DON-0002',
    documentNumber: '70000002',
    fullName: 'Luis Quispe Ramos',
    bloodGroup: 'A-',
    lastDonationDate: '03/06/2026',
    status: 'En evaluación',
  },
];

export const inventoryMock: InventorySummary[] = [
  {
    id: 'GR-2026-001',
    component: 'Glóbulos rojos',
    bloodGroup: 'O+',
    expiresAt: '18/10/2026',
    location: 'Cámara 01',
    status: 'Disponible',
  },
  {
    id: 'PFC-2026-002',
    component: 'Plasma fresco congelado',
    bloodGroup: 'A-',
    expiresAt: '20/09/2027',
    location: 'Congelador 02',
    status: 'Cuarentena',
  },
];
