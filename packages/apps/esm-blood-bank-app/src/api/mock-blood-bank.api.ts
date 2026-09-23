import { dashboardMock, donorsMock, inventoryMock } from '../mocks/blood-bank.mock';
import type { BloodBankApi } from './blood-bank.api';

const copy = <T,>(value: T): T => structuredClone(value);

export const mockBloodBankApi: BloodBankApi = {
  async getDashboard() {
    return copy(dashboardMock);
  },
  async getDonors() {
    return copy(donorsMock);
  },
  async getInventory() {
    return copy(inventoryMock);
  },
};
