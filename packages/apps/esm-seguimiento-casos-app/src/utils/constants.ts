// ── Encounter representation ──
export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

// ── Patient tracing ──
export const MissedAppointmentDate_UUID = '164093AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const TracingType_UUID = 'a55f9516-ddb6-47ec-b10d-cb99d1d0bd41';
export const TracingNumber_UUID = '1639AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const Contacted_UUID = '160721AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const TracingOutcome_UUID = '160433AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// ── Admission details ──
export const AdmissionDate_UUID = '1640AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const PriorityOfAdmission_UUID = '1655AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const AdmissionWard_UUID = '5fc29316-0869-4b3b-ae2f-cc37c6014eb7';

// ── Social history ──
export const Alcohol_Use_UUID = '159449AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const Alcohol_Use_Duration_UUID = '1546AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const Smoking_UUID = '163201AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const Smoking_Duration_UUID = '159931AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const Other_Substance_Abuse_UUID = '163731AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// ── Medical history ──
export const SURGICAL_HISTORY_UUID = '30fe6669-75f3-4a1d-89c3-753a060d559a';
export const ACCIDENT_TRAUMA_UUID = '159520AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const BLOOD_TRANSFUSION_UUID = '161927AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const CHRONIC_DISEASE_UUID = '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// ── Boolean concepts ──
export const TRUE_CONCEPT_UUID = 'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3';

// ── Formatting ──
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

// ── App info ──
export const moduleName = '@sihsalus/esm-seguimiento-casos-app';

// ── Workspace names ──
export const patientFormEntryWorkspace = 'patient-form-entry-workspace';
