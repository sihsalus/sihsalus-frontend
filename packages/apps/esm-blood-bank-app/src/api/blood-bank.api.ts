import type { DashboardData, DonorSummary, InventorySummary } from '../types/blood-bank.types';

/** Contrato estable entre las pantallas y cualquier implementación de datos. */
export interface BloodBankApi {
  getDashboard(): Promise<DashboardData>;
  getDonors(): Promise<DonorSummary[]>;
  getInventory(): Promise<InventorySummary[]>;
}
