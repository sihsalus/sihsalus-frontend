// ── Encounter representation ──
export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

// ── Formatting ──
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

// ── App info ──
export const moduleName = '@sihsalus/esm-cred-app';
