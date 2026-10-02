import { openmrsFetch } from '@openmrs/esm-framework';

import type { DashboardData, DonorSummary, InventorySummary } from '../types/blood-bank.types';
import type { BloodBankApi } from './blood-bank.api';

const apiBase = '/ws/rest/v1/bloodbank';

export const openmrsBloodBankApi: BloodBankApi = {
  async getDashboard() {
    const response = await openmrsFetch<DashboardData>(`${apiBase}/dashboard`);
    return response.data;
  },
  async getDonors() {
    const response = await openmrsFetch<DonorSummary[]>(`${apiBase}/donors`);
    return response.data;
  },
  async getInventory() {
    const response = await openmrsFetch<InventorySummary[]>(`${apiBase}/inventory`);
    return response.data;
  },
};
