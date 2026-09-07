import { blockClinicalRecovery } from './quarantine.mjs';

export default function globalSetup(): void {
  blockClinicalRecovery();
}
