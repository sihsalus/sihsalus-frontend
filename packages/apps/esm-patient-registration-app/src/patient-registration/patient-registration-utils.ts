import { parseDate } from '@openmrs/esm-framework';
import * as Yup from 'yup';

import {
  type AddressProperties,
  type AddressValidationSchemaType,
  type Encounter,
  type FormValues,
  type PatientIdentifier,
  type PatientIdentifierValue,
  type PatientUuidMapType,
} from './patient-registration.types';

const familyName2ExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/patient-family-name2';
export const addressUbigeoField: AddressProperties = 'address14';
export const addressUbigeoPathField: AddressProperties = 'address13';
export const addressUbigeoPathSeparator = '|';
export const birthAddressMarkerField: AddressProperties = 'address15';
export const birthAddressMarker = 'SIHSALUS_BIRTH_ADDRESS';

function getFamilyName2(name?: fhir.HumanName): string | undefined {
  const matchingExtension = name?.extension?.find((extension) => extension.url === familyName2ExtensionUrl);
  return matchingExtension?.valueString ?? name?.extension?.[0]?.extension?.[0]?.valueString;
}

export function parseAddressTemplateXml(addressTemplate: string) {
  const templateXmlDoc = new DOMParser().parseFromString(addressTemplate, 'text/xml');
  const nameMappings = templateXmlDoc.querySelector('nameMappings');
  const properties = nameMappings.getElementsByTagName('entry');
  const validationSchemaObjs = Array.prototype.map.call(properties, (property: Element) => {
    const name = property.getElementsByTagName('string')[0].innerHTML;
    const label = property.getElementsByTagName('string')[1].innerHTML;
    const regex = findElementValueInXmlDoc(name, 'elementRegex', templateXmlDoc) || '.*';
    const regexFormat = findElementValueInXmlDoc(name, 'elementRegexFormats', templateXmlDoc) || '';

    return {
      name,
      label,
      regex,
      regexFormat,
    };
  });

  const addressValidationSchema = Yup.object(
    validationSchemaObjs.reduce((final, current) => {
      final[current.name] = Yup.string().matches(current.regex, current.regexFormat);
      return final;
    }, {}),
  );

  const addressFieldValues = Array.prototype.map.call(properties, (property: Element) => {
    const name = property.getElementsByTagName('string')[0].innerHTML;
    return {
      name,
      defaultValue: '',
    };
  });
  return {
    addressFieldValues,
    addressValidationSchema,
  };
}

export function parseAddressTemplateXmlOld(addressTemplate: string) {
  const templateXmlDoc = new DOMParser().parseFromString(addressTemplate, 'text/xml');
  const nameMappings = templateXmlDoc.querySelector('nameMappings').querySelectorAll('property');
  const validationSchemaObjs: AddressValidationSchemaType[] = Array.prototype.map.call(
    nameMappings,
    (nameMapping: Element) => {
      const name = nameMapping.getAttribute('name');
      const label = nameMapping.getAttribute('value');
      const regex = findElementValueInXmlDoc(name, 'elementRegex', templateXmlDoc) || '.*';
      const regexFormat = findElementValueInXmlDoc(name, 'elementRegexFormats', templateXmlDoc) || '';

      return {
        name,
        label,
        regex,
        regexFormat,
      };
    },
  );

  const addressValidationSchema = Yup.object(
    validationSchemaObjs.reduce((final, current) => {
      final[current.name] = Yup.string().matches(current.regex, current.regexFormat);
      return final;
    }, {}),
  );

  const addressFieldValues: Array<{ name: string; defaultValue: string }> = Array.prototype.map.call(
    nameMappings,
    (nameMapping: Element) => {
      const name = nameMapping.getAttribute('name');
      const defaultValue = findElementValueInXmlDoc(name, 'elementDefaults', templateXmlDoc) ?? '';
      return { name, defaultValue };
    },
  );

  return {
    addressFieldValues,
    addressValidationSchema,
  };
}

function findElementValueInXmlDoc(fieldName: string, elementSelector: string, doc: XMLDocument) {
  return doc.querySelector(elementSelector)?.querySelector(`[name=${fieldName}]`)?.getAttribute('value') ?? null;
}

export function scrollIntoView(viewId: string) {
  document.getElementById(viewId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'center',
  });
}

export function cancelRegistration() {
  globalThis.history.back();
}

export function getFormValuesFromFhirPatient(patient: fhir.Patient) {
  const result = {} as FormValues;
  const patientName = patient.name?.[0];
  const additionalPatientName = patient.name?.[1];

  result.patientUuid = patient.id;
  result.givenName = patientName?.given?.[0] ?? '';
  result.middleName = patientName?.given?.[1] ?? '';
  result.familyName = patientName?.family ?? '';
  result.familyName2 = getFamilyName2(patientName) ?? '';
  result.addNameInLocalLanguage = !!additionalPatientName;
  result.additionalGivenName = additionalPatientName?.given?.[0] ?? '';
  result.additionalMiddleName = additionalPatientName?.given?.[1] ?? '';
  result.additionalFamilyName = additionalPatientName?.family ?? '';
  result.additionalFamilyName2 = getFamilyName2(additionalPatientName) ?? '';

  result.gender = patient.gender ?? '';
  result.birthdate = patient.birthDate ? parseDate(patient.birthDate) : undefined;
  result.telephoneNumber = patient.telecom?.find((contact) => contact.system === 'phone')?.value ?? '';

  return result;
}

function getAddressFieldValuesFromFhirAddress(address?: fhir.Address) {
  const result = {};

  if (address) {
    for (const key of Object.keys(address)) {
      switch (key) {
        case 'city':
          result['cityVillage'] = address[key];
          break;
        case 'state':
          result['stateProvince'] = address[key];
          break;
        case 'district':
          result['countyDistrict'] = address[key];
          break;
        case 'extension':
          address[key]?.forEach((ext) => {
            ext.extension?.forEach((extension) => {
              const fieldName = extension.url?.split('#')[1];
              if (fieldName) {
                result[fieldName] = extension.valueString;
              }
            });
          });
          break;
        default:
          if (key === 'country' || key === 'postalCode') {
            result[key] = address[key];
          }
      }
    }
  }

  return result;
}

function getOpenmrsAddressExtensionValue(address: fhir.Address | undefined, field: AddressProperties) {
  if (!address?.extension?.length) {
    return undefined;
  }

  for (const extensionContainer of address.extension) {
    const matchingExtension = extensionContainer.extension?.find((extension) => extension.url?.split('#')[1] === field);

    if (matchingExtension?.valueString) {
      return matchingExtension.valueString;
    }
  }

  return undefined;
}

function getBirthAddressFromFhirPatient(patient: fhir.Patient) {
  return patient.address?.find(
    (address) => getOpenmrsAddressExtensionValue(address, birthAddressMarkerField) === birthAddressMarker,
  );
}

function getResidenceAddressFromFhirPatient(patient: fhir.Patient) {
  return (
    patient.address?.find(
      (address) =>
        address.use === 'home' &&
        getOpenmrsAddressExtensionValue(address, birthAddressMarkerField) !== birthAddressMarker,
    ) ??
    patient.address?.find(
      (address) => getOpenmrsAddressExtensionValue(address, birthAddressMarkerField) !== birthAddressMarker,
    )
  );
}

export function getAddressFieldValuesFromFhirPatient(
  patient: fhir.Patient,
  addressKind: 'residence' | 'birth' = 'residence',
) {
  const address =
    addressKind === 'birth' ? getBirthAddressFromFhirPatient(patient) : getResidenceAddressFromFhirPatient(patient);
  return getAddressFieldValuesFromFhirAddress(address);
}

export function getPatientUuidMapFromFhirPatient(patient: fhir.Patient): PatientUuidMapType {
  const patientName = patient.name?.[0];
  const additionalPatientName = patient.name?.[1];
  const residenceAddress = getResidenceAddressFromFhirPatient(patient);
  const birthAddress = getBirthAddressFromFhirPatient(patient);

  return {
    preferredNameUuid: patientName?.id,
    additionalNameUuid: additionalPatientName?.id,
    preferredAddressUuid: residenceAddress?.id,
    birthAddressUuid: birthAddress?.id,
  };
}

export function getPatientIdentifiersFromFhirPatient(patient: fhir.Patient): Array<PatientIdentifier> {
  return (patient.identifier ?? []).map((identifier) => {
    return {
      uuid: identifier.id,
      identifier: identifier.value,
    };
  });
}

export function getPhonePersonAttributeValueFromFhirPatient(patient: fhir.Patient) {
  const result = {};
  const phone = patient.telecom?.find((contact) => contact.system === 'phone')?.value;
  if (phone) {
    result['telephoneNumber'] = phone;
  }
  return result;
}

type IdentifierMap = { [identifierFieldName: string]: PatientIdentifierValue };
export const filterOutUndefinedPatientIdentifiers = (patientIdentifiers: IdentifierMap): IdentifierMap =>
  Object.fromEntries(
    Object.entries(patientIdentifiers).filter(
      ([_key, value]) =>
        (value.autoGeneration && value.selectedSource?.autoGenerationOption?.manualEntryEnabled) ||
        value.identifierValue !== undefined,
    ),
  );

export const latestFirstEncounter = (a: Encounter, b: Encounter) =>
  new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime();
