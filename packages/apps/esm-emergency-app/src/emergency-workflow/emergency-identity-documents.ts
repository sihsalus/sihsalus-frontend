import type { Config } from '../config-schema';

type EmergencyIdentifierConfig = Pick<
  Config['patientRegistration'],
  | 'defaultIdentifierTypeUuid'
  | 'dieIdentifierTypeUuid'
  | 'foreignCardIdentifierTypeUuid'
  | 'liveBirthCertificateIdentifierTypeUuid'
  | 'otherIdentifierTypeUuid'
  | 'passportIdentifierTypeUuid'
>;

export function getEmergencyIdentityDocumentTypes(config: EmergencyIdentifierConfig) {
  return [
    { label: 'DNI', value: config.defaultIdentifierTypeUuid },
    { label: 'CE', value: config.foreignCardIdentifierTypeUuid },
    { label: 'Pasaporte', value: config.passportIdentifierTypeUuid },
    { label: 'Cédula de Identidad', value: config.dieIdentifierTypeUuid },
    { label: 'CNV', value: config.liveBirthCertificateIdentifierTypeUuid },
    { label: 'Otros', value: config.otherIdentifierTypeUuid },
  ].filter((type) => type.value);
}
