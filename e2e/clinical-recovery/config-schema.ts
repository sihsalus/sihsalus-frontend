import { loadE2EGateConfig } from '../utils/e2e-gate-config';
import { blockClinicalRecovery } from './quarantine.mjs';

export interface RecoveryConfig {
  patientUuid: string;
  visitUuid: string;
  spaBaseUrl: string;
  drugUuid: string;
  drugDisplay: string;
  drugSearch: string;
  drugOrderTypeUuid: string;
  testOrderTypeUuid: string;
  testConceptUuid: string;
  dose: string;
  doseUnit: string;
  route: string;
  frequency: string;
  duration: string;
  durationUnit: string;
}

/** Proposed explicit fixture contract. Never enabled by environment variables alone. */
export function loadRecoveryConfig(environment: NodeJS.ProcessEnv = process.env): RecoveryConfig {
  blockClinicalRecovery();
  const gate = loadE2EGateConfig(environment);
  const value = (name: string) => {
    const configured = environment[name]?.trim();
    if (!configured) throw new Error(`${name} is required for the recovered proposal.`);
    return configured;
  };
  const uuid = (name: string) => {
    const configured = value(name);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configured)) {
      throw new Error(`${name} must be a canonical UUID.`);
    }
    return configured;
  };
  const positiveNumber = (name: string) => {
    const configured = value(name);
    if (!/^\d+(?:\.\d+)?$/.test(configured) || !Number.isFinite(Number(configured)) || Number(configured) <= 0) {
      throw new Error(`${name} must be a positive finite fixture value.`);
    }
    return configured;
  };
  return {
    patientUuid: gate.patientUuid,
    visitUuid: uuid('E2E_OUTPATIENT_VISIT_UUID'),
    spaBaseUrl: gate.spaBaseUrl,
    drugUuid: uuid('E2E_ORDERABLE_MEDICATION_UUID'),
    drugDisplay: value('E2E_ORDERABLE_MEDICATION_DISPLAY'),
    drugSearch: value('E2E_ORDERABLE_MEDICATION_SEARCH_TERM'),
    drugOrderTypeUuid: uuid('E2E_RECOVERY_DRUG_ORDER_TYPE_UUID'),
    testOrderTypeUuid: uuid('E2E_RECOVERY_TEST_ORDER_TYPE_UUID'),
    testConceptUuid: uuid('E2E_RECOVERY_TEST_CONCEPT_UUID'),
    dose: positiveNumber('E2E_RECOVERY_DOSE'),
    doseUnit: value('E2E_RECOVERY_DOSE_UNIT'),
    route: value('E2E_RECOVERY_ROUTE'),
    frequency: value('E2E_RECOVERY_FREQUENCY'),
    duration: positiveNumber('E2E_RECOVERY_DURATION'),
    durationUnit: value('E2E_RECOVERY_DURATION_UNIT'),
  };
}
