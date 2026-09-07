import { type Page } from '@playwright/test';

export class LaboratoryPage {
  constructor(readonly page: Page) {}

  private getPatientNameCell(patientName: string) {
    const normalizedName = patientName.replace(/\s+/g, ' ').trim();
    if (!normalizedName) throw new Error('A nonempty synthetic patient name is required for the laboratory row.');
    return this.page.getByRole('cell', { name: normalizedName, exact: true });
  }

  async goTo() {
    await this.page.goto('home/laboratory');
  }

  async navigateToTab(tabName: string) {
    await this.page.getByRole('tab', { name: tabName }).click();
  }

  async expandPatientRow(patientName: string) {
    await this.getPatientRow(patientName).getByLabel('Expand current row').click();
  }

  async searchFor(text: string) {
    await this.page.getByPlaceholder('Search this list').fill(text);
  }

  getPatientRow(patientName: string) {
    return this.page.getByRole('row').filter({ has: this.getPatientNameCell(patientName) });
  }
}
