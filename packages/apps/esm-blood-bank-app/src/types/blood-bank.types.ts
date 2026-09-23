export type WorkItemStatus = 'Pendiente' | 'En proceso' | 'Completado' | 'Alerta';

export interface DashboardMetric {
  id: string;
  labelKey: string;
  defaultLabel: string;
  value: number;
}

export interface WorkItem {
  id: string;
  section: string;
  description: string;
  status: WorkItemStatus;
}

export interface DonorSummary {
  id: string;
  documentNumber: string;
  fullName: string;
  bloodGroup: string;
  lastDonationDate: string;
  status: 'Apto' | 'Diferido' | 'En evaluación';
}

export interface InventorySummary {
  id: string;
  component: string;
  bloodGroup: string;
  expiresAt: string;
  location: string;
  status: 'Disponible' | 'Reservada' | 'Cuarentena';
}

export interface DashboardData {
  metrics: DashboardMetric[];
  workItems: WorkItem[];
}
