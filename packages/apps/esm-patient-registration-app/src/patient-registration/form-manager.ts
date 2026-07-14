import {
  type FetchResponse,
  getConfig,
  queueSynchronizationItem,
  restBaseUrl,
  type Session,
  type StyleguideConfigObject,
  toOmrsIsoString,
} from '@openmrs/esm-framework';

import { type RegistrationConfig } from '../config-schema';
import { patientRegistration } from '../constants';
import {
  identityVerificationSourceConceptUuids,
  identityVerificationStatusConceptUuids,
  personIdentityVerificationSourceAttributeTypeUuid,
  personIdentityVerificationStatusAttributeTypeUuid,
  personIdentityVerifiedAtAttributeTypeUuid,
} from './identity/identity-documents';
import { fetchPersonForPromotion, isPersonAlreadyPatient } from './identity/identity-search.resource';
import { verifyIdentityForPromotion } from './identity/identity-verification.resource';
import {
  buildDocumentIdentifierForPromotion,
  getPersonDocument,
  getPreferredAddress,
  getPreferredName,
} from './identity/promotion';
import {
  addPatientIdentifier,
  deletePersonAttribute,
  deletePatientIdentifier,
  deletePersonName,
  deleteRelationship,
  generateIdentifier,
  getDatetime,
  promotePersonToPatient,
  saveEncounter,
  savePatient,
  savePatientPhoto,
  savePatientPhotoAsAttachment,
  savePerson,
  saveRelationship,
  updatePatientIdentifier,
  updateRelationship,
} from './patient-registration.resource';
import {
  type AddressProperties,
  type AttributeValue,
  type CapturePhotoProps,
  type Encounter,
  type FormValues,
  type Patient,
  type PatientAddress,
  type PatientIdentifier,
  type PatientRegistration,
  type PatientUuidMapType,
  type RelationshipValue,
} from './patient-registration.types';
import {
  addressUbigeoField,
  addressUbigeoPathField,
  birthAddressMarker,
  birthAddressMarkerField,
} from './patient-registration-utils';
import { buildResponsiblePersonPayload } from './section/patient-relationships/responsible-person.utils';

const familyName2ExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/patient-family-name2';
const addressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';
const fhirAddressExtensionFields: Array<AddressProperties> = [
  'address1',
  'address2',
  'address3',
  'address4',
  'address5',
  'address6',
  'address7',
  'address8',
  'address9',
  'address10',
  'address11',
  'address12',
  'address13',
  'address14',
  'address15',
  'cityVillage',
  'stateProvince',
  'countyDistrict',
  'postalCode',
  'country',
];

function hasAddressContent(address: FormValues['address'] | undefined) {
  return Object.entries(address ?? {}).some(
    ([field, value]) =>
      field !== birthAddressMarkerField &&
      field !== addressUbigeoField &&
      field !== addressUbigeoPathField &&
      !!value?.trim(),
  );
}

function cleanAddress(address: FormValues['address'] | undefined): Partial<Record<AddressProperties, string>> {
  return Object.fromEntries(
    Object.entries(address ?? {}).filter(([, value]) => typeof value === 'string' && value.trim()),
  ) as Partial<Record<AddressProperties, string>>;
}

function getAddressExtensions(address: PatientAddress) {
  const extension = fhirAddressExtensionFields
    .filter((field) => !!address[field])
    .map((field) => ({
      url: `${addressExtensionUrl}#${field}`,
      valueString: address[field],
    }));

  return extension.length ? [{ url: addressExtensionUrl, extension }] : undefined;
}

function getPersonAttributeValue(patient: Partial<Patient>, attributeTypeUuid?: string) {
  if (!attributeTypeUuid) {
    return undefined;
  }

  return patient.person?.attributes?.find((attribute) => attribute.attributeType === attributeTypeUuid)?.value;
}

function isValidAttributeTypeKey(attributeType: string) {
  const normalizedAttributeType = attributeType?.trim();
  return (
    !!normalizedAttributeType &&
    normalizedAttributeType !== 'undefined' &&
    normalizedAttributeType !== 'null' &&
    normalizedAttributeType !== 'attributeType'
  );
}

interface RelationshipTransactionState {
  companionCompleted?: boolean;
  companionRemoved?: boolean;
  companionRelationshipUuid?: string;
  companionSignature?: string;
  mainCompleted?: boolean;
  mainRelationshipUuid?: string;
  mainSignature?: string;
  relatedPersonUuid?: string;
}

interface IdentifierTransactionState {
  existsOnServer: boolean;
  initialized: boolean;
  persistedValue?: string;
  resourceUuid?: string;
}

function getRelationshipTransactionKey(relationship: RelationshipValue) {
  return (
    relationship.uuid ??
    relationship.clientId ??
    [
      relationship.relatedPersonUuid,
      relationship.relationshipType,
      relationship.newPerson?.givenName,
      relationship.newPerson?.familyName,
    ].join('|')
  );
}

function getMainRelationshipTransactionSignature(relationship: RelationshipValue, relatedPersonUuid?: string) {
  return JSON.stringify({
    action: relationship.action,
    relatedPersonUuid,
    relationshipType: relationship.relationshipType,
    uuid: relationship.uuid,
  });
}

function getCompanionRelationshipTransactionSignature(
  relationship: RelationshipValue,
  relatedPersonUuid: string | undefined,
  companionRelationshipType: string | undefined,
  companionRelationshipUuid: string | undefined,
) {
  return JSON.stringify({
    action: relationship.action,
    companionRelationshipType,
    companionRelationshipUuid,
    isCompanion: !!relationship.isCompanion,
    relatedPersonUuid,
  });
}

function getIdentifierFormSignature(identifiers: FormValues['identifiers']) {
  return JSON.stringify(
    Object.entries(identifiers ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([fieldName, identifier]) => ({
        autoGeneration: !!identifier.autoGeneration,
        fieldName,
        identifierTypeUuid: identifier.identifierTypeUuid,
        identifierValue: identifier.identifierValue,
        preferred: !!identifier.preferred,
        selectedSourceUuid: identifier.selectedSource?.uuid,
      })),
  );
}

function getPatientPayloadSignature(patient: Patient) {
  const { identifiers: _identifiers, ...demographicPayload } = patient;
  return JSON.stringify(demographicPayload);
}

function registrationError(message: string) {
  return {
    responseBody: {
      error: { message },
    },
  };
}

function ensureTransactionState(transactionManager: SavePatientTransactionManager) {
  transactionManager.deletedAttributeUuids ??= {};
  transactionManager.deletedIdentifierUuids ??= {};
  transactionManager.deletedNameUuids ??= {};
  transactionManager.generatedIdentifiers ??= {};
  transactionManager.identifierRows ??= {};
  transactionManager.relationshipRows ??= {};
  transactionManager.observationsSaved ??= false;
  transactionManager.patientSaved ??= false;
  transactionManager.photoSaved ??= false;
  transactionManager.promotionAttributes ??= [];
  transactionManager.promotionCompleted ??= false;
  return transactionManager;
}

export type SavePatientForm = (
  isNewPatient: boolean,
  values: FormValues,
  patientUuidMap: PatientUuidMapType,
  initialAddressFieldValues: Record<string, unknown>,
  capturePhotoProps: CapturePhotoProps | null,
  currentLocation: string,
  initialIdentifierValues: FormValues['identifiers'],
  currentUser: Session,
  config: RegistrationConfig,
  savePatientTransactionManager: SavePatientTransactionManager,
  abortController?: AbortController,
) => Promise<string | null>;

export class FormManager {
  static savePatientFormOffline: SavePatientForm = async (
    isNewPatient,
    values,
    patientUuidMap,
    initialAddressFieldValues,
    capturePhotoProps,
    currentLocation,
    initialIdentifierValues,
    currentUser,
    config,
    savePatientTransactionManager,
  ) => {
    if (values.personUuidToPromote) {
      // Promotion needs the live backend: the already-a-patient pre-check and duplicate
      // detection cannot run offline, and a queued promotion could collide with another
      // operator promoting the same person.
      throw {
        responseBody: {
          error: {
            message:
              'La promoción de una persona existente a paciente no está disponible sin conexión. Conéctese e intente nuevamente.',
          },
        },
      };
    }

    const syncItem: PatientRegistration = {
      fhirPatient: FormManager.mapPatientToFhirPatient(
        FormManager.getPatientToCreate(isNewPatient, values, patientUuidMap, initialAddressFieldValues, [], config),
        config,
      ),
      _patientRegistrationData: {
        isNewPatient,
        formValues: values,
        patientUuidMap,
        initialAddressFieldValues,
        capturePhotoProps,
        currentLocation,
        initialIdentifierValues,
        currentUser,
        config,
        savePatientTransactionManager: ensureTransactionState(
          savePatientTransactionManager ?? new SavePatientTransactionManager(),
        ),
      },
    };

    await queueSynchronizationItem(patientRegistration, syncItem, {
      id: values.patientUuid,
      displayName: 'Patient registration',
      patientUuid: syncItem.fhirPatient.id,
      dependencies: [],
    });

    return null;
  };

  static savePatientFormOnline: SavePatientForm = async (
    isNewPatient,
    values,
    patientUuidMap,
    initialAddressFieldValues,
    capturePhotoProps,
    currentLocation,
    initialIdentifierValues,
    currentUser,
    config,
    savePatientTransactionManager,
    abortController,
  ) => {
    savePatientTransactionManager ??= new SavePatientTransactionManager();
    ensureTransactionState(savePatientTransactionManager);
    const signal = abortController?.signal;
    const personUuidToPromote = isNewPatient ? values.personUuidToPromote : undefined;

    if (
      isNewPatient &&
      savePatientTransactionManager.newPatientIdentifierSignature &&
      savePatientTransactionManager.newPatientIdentifierSignature !== getIdentifierFormSignature(values.identifiers)
    ) {
      throw registrationError(
        'El paciente ya fue creado parcialmente y sus identificadores cambiaron. Abra el paciente existente para editar su identificación.',
      );
    }

    if (personUuidToPromote && values.patientUuid !== personUuidToPromote) {
      // The whole point of promotion is reusing the person's identity: never let a
      // stray client-generated UUID replace it.
      values = { ...values, patientUuid: personUuidToPromote };
    }

    FormManager.assertObservationConfiguration(values.obs, currentLocation, currentUser, config);

    const patientIdentifiers: Array<PatientIdentifier> = await FormManager.savePatientIdentifiers(
      isNewPatient,
      values.patientUuid,
      values.identifiers,
      initialIdentifierValues,
      currentLocation,
      savePatientTransactionManager,
      signal,
    );

    let effectivePatientUuidMap = patientUuidMap;
    let promotionAttributes: Array<AttributeValue> = [];

    if (personUuidToPromote) {
      const promotion = savePatientTransactionManager.promotionCompleted
        ? {
            patientUuidMap: savePatientTransactionManager.promotionPatientUuidMap ?? {},
            verificationAttributes: savePatientTransactionManager.promotionAttributes,
          }
        : await FormManager.promoteExistingPerson(
            personUuidToPromote,
            patientIdentifiers,
            currentLocation,
            savePatientTransactionManager.patientSaved,
            signal,
          );
      savePatientTransactionManager.promotionCompleted = true;
      savePatientTransactionManager.promotionPatientUuidMap = promotion.patientUuidMap;
      savePatientTransactionManager.promotionAttributes = promotion.verificationAttributes;
      savePatientTransactionManager.patientSaved = true;
      savePatientTransactionManager.savedPatientUuid = personUuidToPromote;
      savePatientTransactionManager.newPatientIdentifierSignature = getIdentifierFormSignature(values.identifiers);
      // Reuse the person's existing preferred name/address rows in the follow-up
      // demographic update so it edits them instead of appending duplicates.
      effectivePatientUuidMap = { ...patientUuidMap, ...promotion.patientUuidMap };
      promotionAttributes = promotion.verificationAttributes;
    }

    const createdPatient = FormManager.getPatientToCreate(
      isNewPatient,
      values,
      effectivePatientUuidMap,
      initialAddressFieldValues,
      patientIdentifiers,
      config,
    );

    if (personUuidToPromote || !isNewPatient || savePatientTransactionManager.patientSaved) {
      // Identifiers were already created by the promotion call; re-sending them on the
      // demographic update (or a retry update) would duplicate them.
      delete (createdPatient as Partial<Patient>).identifiers;
    }

    if (personUuidToPromote) {
      createdPatient.person.attributes = [...createdPatient.person.attributes, ...promotionAttributes];
    }

    const patientWasAlreadySaved = savePatientTransactionManager.patientSaved;
    const patientPayloadSignature = getPatientPayloadSignature(createdPatient);

    if (
      savePatientTransactionManager.patientSaved &&
      savePatientTransactionManager.patientPayloadSignature &&
      savePatientTransactionManager.patientPayloadSignature !== patientPayloadSignature
    ) {
      throw registrationError(
        'El paciente ya fue guardado parcialmente y sus datos cambiaron. Recargue el paciente antes de continuar para evitar registros duplicados.',
      );
    }

    const savePatientResponse =
      savePatientTransactionManager.patientSaved &&
      savePatientTransactionManager.patientPayloadSignature === patientPayloadSignature &&
      savePatientTransactionManager.savedPatientUuid
        ? ({
            data: { uuid: savePatientTransactionManager.savedPatientUuid },
            ok: true,
          } as FetchResponse)
        : await savePatient(
            createdPatient,
            isNewPatient && !savePatientTransactionManager.patientSaved ? undefined : values.patientUuid,
            signal,
          );

    if (savePatientResponse.ok) {
      savePatientTransactionManager.patientSaved = true;
      savePatientTransactionManager.patientPayloadSignature = patientPayloadSignature;
      savePatientTransactionManager.savedPatientUuid = savePatientResponse.data.uuid;
      if (isNewPatient && !patientWasAlreadySaved) {
        savePatientTransactionManager.newPatientIdentifierSignature = getIdentifierFormSignature(values.identifiers);
      }

      for (const name of FormManager.getDeletedNames(values, patientUuidMap)) {
        if (!savePatientTransactionManager.deletedNameUuids[name.nameUuid]) {
          await deletePersonName(name.nameUuid, name.personUuid, signal);
          savePatientTransactionManager.deletedNameUuids[name.nameUuid] = true;
        }
      }

      await FormManager.deleteRemovedPatientAttributes(
        isNewPatient,
        values,
        patientUuidMap,
        savePatientTransactionManager,
        signal,
      );

      await this.saveRelationships(
        values.relationships,
        savePatientResponse,
        {
          companionRelationshipType: config.relationshipOptions?.companionRelationshipType,
          phoneAttributeTypeUuid: config.fieldConfigurations?.phone?.personAttributeUuid,
        },
        savePatientTransactionManager,
        signal,
      );

      await this.saveObservations(
        values.obs,
        savePatientResponse,
        currentLocation,
        currentUser,
        config,
        savePatientTransactionManager,
        signal,
      );

      if (capturePhotoProps?.imageData && !savePatientTransactionManager.photoSaved) {
        const { patientPhotoConceptUuid } = await getConfig<StyleguideConfigObject>('@openmrs/esm-styleguide');
        const savePhotoAsAttachment = async () => {
          try {
            await savePatientPhotoAsAttachment(savePatientResponse.data.uuid, capturePhotoProps.imageData);
            savePatientTransactionManager.photoSaved = true;
          } catch (attachmentError) {
            console.warn('Patient photo could not be saved as an attachment.', attachmentError);
          }
        };

        if (patientPhotoConceptUuid) {
          try {
            await savePatientPhoto(
              savePatientResponse.data.uuid,
              capturePhotoProps.imageData,
              `${restBaseUrl}/obs`,
              capturePhotoProps.dateTime || new Date().toISOString(),
              patientPhotoConceptUuid,
              signal,
            );
            savePatientTransactionManager.photoSaved = true;
          } catch (error) {
            console.warn('Patient photo could not be saved. Continuing after patient registration succeeded.', error);
            await savePhotoAsAttachment();
          }
        } else {
          await savePhotoAsAttachment();
        }
      }
    }

    return savePatientResponse.data.uuid;
  };

  /**
   * Converts an existing person into a patient via `POST /patient` with the person
   * UUID as a string, keeping that same UUID on the resulting patient.
   *
   * The backend accepts a second promotion of the same person and silently appends
   * duplicate identifiers, so this always re-checks patient existence right before
   * promoting (unless the promotion already succeeded within this submit transaction).
   */
  static async promoteExistingPerson(
    personUuid: string,
    patientIdentifiers: Array<PatientIdentifier>,
    currentLocation: string,
    alreadyPromotedInSession: boolean,
    signal?: AbortSignal,
  ): Promise<{ patientUuidMap: PatientUuidMapType; verificationAttributes: Array<AttributeValue> }> {
    if (!alreadyPromotedInSession && (await isPersonAlreadyPatient(personUuid))) {
      throw {
        responseBody: {
          error: {
            message:
              'Esta persona ya está registrada como paciente (posiblemente otro usuario la promovió). Búsquela en el buscador de pacientes en lugar de registrarla de nuevo.',
          },
        },
      };
    }

    const person = await fetchPersonForPromotion(personUuid);
    const verificationAttributes: Array<AttributeValue> = [];
    const { documentTypeConceptUuid, documentNumber } = getPersonDocument(person);

    if (documentTypeConceptUuid && documentNumber) {
      // Identity verification hook. The identitylookup OMOD is not deployed yet, so the
      // outcome is 'unavailable'/'not-applicable' today; once it is deployed, verified
      // promotions will persist their verification state without further changes here.
      try {
        const outcome = await verifyIdentityForPromotion({
          documentTypeConceptUuid,
          documentNumber,
          givenName: getPreferredName(person)?.givenName,
          familyName: getPreferredName(person)?.familyName,
          familyName2: getPreferredName(person)?.familyName2,
          birthdate: person.birthdate,
        });

        if (outcome.status === 'verified') {
          verificationAttributes.push(
            {
              attributeType: personIdentityVerificationStatusAttributeTypeUuid,
              value: identityVerificationStatusConceptUuids.verifiedByReniec,
            },
            {
              attributeType: personIdentityVerificationSourceAttributeTypeUuid,
              value: identityVerificationSourceConceptUuids.reniec,
            },
            { attributeType: personIdentityVerifiedAtAttributeTypeUuid, value: outcome.verifiedAt },
          );
        } else if (outcome.status === 'mismatch') {
          throw {
            responseBody: {
              error: {
                message: `Los datos de la persona no coinciden con la fuente de verificación: ${outcome.observation}. Resuelva la discrepancia antes de promover.`,
              },
            },
          };
        }
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'responseBody' in error) {
          throw error;
        }
        // Verification unavailability must never block registration (doc: "no bloquear
        // ante caídas"); the identity simply stays unverified.
        console.warn('Identity verification is unavailable; continuing with promotion.', error);
      }
    }

    if (!alreadyPromotedInSession) {
      const identifiers = [...patientIdentifiers];
      const documentIdentifier = buildDocumentIdentifierForPromotion(person, identifiers, currentLocation);

      if (documentIdentifier) {
        identifiers.push(documentIdentifier);
      }

      await promotePersonToPatient(personUuid, identifiers, signal);
    }

    return {
      patientUuidMap: {
        preferredNameUuid: getPreferredName(person)?.uuid,
        preferredAddressUuid: getPreferredAddress(person)?.uuid,
      },
      verificationAttributes,
    };
  }

  static async saveRelationships(
    relationships: Array<RelationshipValue> | undefined,
    savePatientResponse: FetchResponse,
    options: { companionRelationshipType?: string; phoneAttributeTypeUuid?: string } = {},
    transactionManager: SavePatientTransactionManager = new SavePatientTransactionManager(),
    signal?: AbortSignal,
  ) {
    const thisPatientUuid = savePatientResponse.data.uuid;
    const results: Array<unknown> = [];

    for (const relationship of relationships ?? []) {
      if (relationship.relationshipType && relationship.action) {
        results.push(
          await FormManager.saveRelationshipForRow(relationship, thisPatientUuid, options, transactionManager, signal),
        );
      }
    }

    return results;
  }

  static async saveRelationshipForRow(
    relationship: RelationshipValue,
    thisPatientUuid: string,
    options: { companionRelationshipType?: string; phoneAttributeTypeUuid?: string },
    transactionManager: SavePatientTransactionManager = new SavePatientTransactionManager(),
    signal?: AbortSignal,
  ) {
    const { relationshipType, uuid: relationshipUuid, action, isCompanion, companionRelationshipUuid } = relationship;
    let { relatedPersonUuid } = relationship;
    const transactionKey = getRelationshipTransactionKey(relationship);
    const state: RelationshipTransactionState = transactionManager.relationshipRows[transactionKey] ?? {};
    transactionManager.relationshipRows[transactionKey] = state;
    relatedPersonUuid ||= state.relatedPersonUuid;

    // Pending responsible person: created here, right before its relationship, so an
    // abandoned registration never leaves an orphaned person in the database.
    if (!relatedPersonUuid && action === 'ADD' && relationship.newPerson) {
      const responsiblePerson = buildResponsiblePersonPayload(relationship.newPerson, {
        phoneAttributeTypeUuid: options.phoneAttributeTypeUuid,
      });
      const savePersonResponse = signal
        ? await savePerson(responsiblePerson, signal)
        : await savePerson(responsiblePerson);
      relatedPersonUuid = savePersonResponse?.data?.uuid;

      if (!relatedPersonUuid) {
        throw new Error('The backend did not return a person UUID for the new responsible person');
      }
      state.relatedPersonUuid = relatedPersonUuid;
    }

    if (!relatedPersonUuid && action !== 'DELETE') {
      throw registrationError('Seleccione o registre una persona antes de guardar la relación.');
    }

    const [type, direction] = relationshipType.split('/');
    const isAToB = direction === 'aIsToB';
    const relationshipToSave = {
      personA: isAToB ? relatedPersonUuid : thisPatientUuid,
      personB: isAToB ? thisPatientUuid : relatedPersonUuid,
      relationshipType: type,
    };
    const mainSignature = getMainRelationshipTransactionSignature(relationship, relatedPersonUuid);

    if (state.mainCompleted && state.mainSignature !== mainSignature) {
      throw registrationError(
        'La relación cambió después de guardarse parcialmente. Restablezca sus datos anteriores y vuelva a intentar.',
      );
    }

    if (!state.mainCompleted) {
      switch (action) {
        case 'ADD': {
          const response = signal
            ? await saveRelationship(relationshipToSave, signal)
            : await saveRelationship(relationshipToSave);
          state.mainRelationshipUuid = response?.data?.uuid;
          state.mainCompleted = true;
          break;
        }
        case 'UPDATE':
          if (!relationshipUuid) {
            throw new Error('An existing relationship UUID is required for update');
          }
          if (signal) {
            await updateRelationship(relationshipUuid, relationshipToSave, signal);
          } else {
            await updateRelationship(relationshipUuid, relationshipToSave);
          }
          state.mainCompleted = true;
          break;
        case 'DELETE':
          if (relationshipUuid) {
            if (signal) {
              await deleteRelationship(relationshipUuid, signal);
            } else {
              await deleteRelationship(relationshipUuid);
            }
          }
          state.mainCompleted = true;
          break;
        default:
          break;
      }
      state.mainSignature = mainSignature;
    }

    // The primary responsible person is persisted through the companion relationship
    // already consumed by downstream workflows. Create or remove it with the selection.
    if (options.companionRelationshipType) {
      const [companionType, companionDirection] = options.companionRelationshipType.split('/');
      const companionIsAToB = companionDirection === 'aIsToB';
      const wantsCompanion = !!isCompanion && action !== 'DELETE';
      const mainRelationshipIsCompanion = type === companionType;
      const effectiveCompanionRelationshipUuid = state.companionRemoved
        ? undefined
        : (state.companionRelationshipUuid ?? companionRelationshipUuid);
      const companionSignature = getCompanionRelationshipTransactionSignature(
        relationship,
        relatedPersonUuid,
        options.companionRelationshipType,
        effectiveCompanionRelationshipUuid,
      );

      if (state.companionSignature !== companionSignature) {
        state.companionCompleted = false;
      }

      if (
        !state.companionCompleted &&
        !mainRelationshipIsCompanion &&
        wantsCompanion &&
        !effectiveCompanionRelationshipUuid
      ) {
        const companionRelationship = {
          personA: companionIsAToB ? relatedPersonUuid : thisPatientUuid,
          personB: companionIsAToB ? thisPatientUuid : relatedPersonUuid,
          relationshipType: companionType,
        };
        const response = signal
          ? await saveRelationship(companionRelationship, signal)
          : await saveRelationship(companionRelationship);
        state.companionRelationshipUuid = response?.data?.uuid;
        state.companionRemoved = false;
        state.companionCompleted = true;
      } else if (!state.companionCompleted && !wantsCompanion && effectiveCompanionRelationshipUuid) {
        if (signal) {
          await deleteRelationship(effectiveCompanionRelationshipUuid, signal);
        } else {
          await deleteRelationship(effectiveCompanionRelationshipUuid);
        }
        state.companionRelationshipUuid = undefined;
        state.companionRemoved = true;
        state.companionCompleted = true;
      } else if (mainRelationshipIsCompanion || effectiveCompanionRelationshipUuid || !wantsCompanion) {
        state.companionCompleted = true;
      }
      state.companionSignature = getCompanionRelationshipTransactionSignature(
        relationship,
        relatedPersonUuid,
        options.companionRelationshipType,
        state.companionRemoved ? undefined : (state.companionRelationshipUuid ?? companionRelationshipUuid),
      );
    }

    return state;
  }

  static async saveObservations(
    obss: { [conceptUuid: string]: string },
    savePatientResponse: FetchResponse,
    currentLocation: string,
    currentUser: Session,
    config: RegistrationConfig,
    transactionManager: SavePatientTransactionManager = new SavePatientTransactionManager(),
    signal?: AbortSignal,
  ) {
    const observations = Object.entries(obss ?? {})
      .filter(([, value]) => value !== '')
      .map(([conceptUuid, value]) => ({ concept: conceptUuid, value }));

    if (!observations.length || transactionManager.observationsSaved) {
      return;
    }

    FormManager.assertObservationConfiguration(obss, currentLocation, currentUser, config);
    const encounterToSave: Encounter = {
      encounterDatetime: new Date(),
      patient: savePatientResponse.data.uuid,
      encounterType: config.registrationObs.encounterTypeUuid,
      location: currentLocation,
      encounterProviders: [
        {
          provider: currentUser.currentProvider.uuid,
          encounterRole: config.registrationObs.encounterProviderRoleUuid,
        },
      ],
      form: config.registrationObs.registrationFormUuid,
      obs: observations,
    };
    const response = await saveEncounter(encounterToSave, signal);
    transactionManager.observationsSaved = true;
    return response;
  }

  static assertObservationConfiguration(
    obss: { [conceptUuid: string]: string } | undefined,
    currentLocation: string,
    currentUser: Session,
    config: RegistrationConfig,
  ) {
    if (!Object.values(obss ?? {}).some((value) => value !== '')) {
      return;
    }

    const missingConfiguration: Array<string> = [];
    if (!config.registrationObs?.encounterTypeUuid) {
      missingConfiguration.push('tipo de encuentro');
    }
    if (!config.registrationObs?.encounterProviderRoleUuid) {
      missingConfiguration.push('rol del proveedor');
    }
    if (!config.registrationObs?.registrationFormUuid) {
      missingConfiguration.push('formulario de registro');
    }
    if (!currentLocation) {
      missingConfiguration.push('ubicación de sesión');
    }
    if (!currentUser?.currentProvider?.uuid) {
      missingConfiguration.push('proveedor de la sesión');
    }

    if (missingConfiguration.length) {
      throw registrationError(
        `No se puede guardar la información clínica del registro. Falta configurar: ${missingConfiguration.join(', ')}.`,
      );
    }
  }

  static async savePatientIdentifiers(
    isNewPatient: boolean,
    patientUuid: string,
    patientIdentifiers: FormValues['identifiers'], // values.identifiers
    initialIdentifierValues: FormValues['identifiers'], // Initial identifiers assigned to the patient
    location: string,
    transactionManager: SavePatientTransactionManager = new SavePatientTransactionManager(),
    signal?: AbortSignal,
  ): Promise<Array<PatientIdentifier>> {
    ensureTransactionState(transactionManager);

    const initializeIdentifierRow = (
      identifierFieldName: string,
      initialIdentifier?: FormValues['identifiers'][string],
    ) => {
      const existingState = transactionManager.identifierRows[identifierFieldName];
      if (existingState?.initialized) {
        return existingState;
      }

      const persistedValue = initialIdentifier?.initialValue || initialIdentifier?.identifierValue || undefined;
      const state: IdentifierTransactionState = {
        existsOnServer: !!persistedValue,
        initialized: true,
        persistedValue,
        resourceUuid: initialIdentifier?.identifierUuid,
      };
      transactionManager.identifierRows[identifierFieldName] = state;
      return state;
    };

    if (!isNewPatient) {
      Object.entries(initialIdentifierValues ?? {}).forEach(([fieldName, identifier]) => {
        initializeIdentifierRow(fieldName, identifier);
      });
    }

    const activeIdentifierEntries = Object.entries(patientIdentifiers ?? {}).filter(
      ([, { identifierValue, autoGeneration, selectedSource }]) =>
        Boolean(identifierValue || (autoGeneration && selectedSource)),
    );
    const activeIdentifierFields = new Set(activeIdentifierEntries.map(([fieldName]) => fieldName));
    const identifierTypeRequests = activeIdentifierEntries
      /* Since default identifier-types will be present on the form and are also in the not-required state,
        therefore we might be running into situations when there's no value and no source associated,
        hence filtering these fields out.
      */
      .map(async ([identifierFieldName, patientIdentifier]) => {
        const { identifierTypeUuid, identifierValue, identifierUuid, selectedSource, preferred, autoGeneration } =
          patientIdentifier;

        const autoGenerationManualEntry =
          autoGeneration && selectedSource?.autoGenerationOption?.manualEntryEnabled && !!identifierValue;

        let identifier = identifierValue;
        if (autoGeneration && !autoGenerationManualEntry) {
          identifier = transactionManager.generatedIdentifiers[identifierFieldName];
          if (!identifier) {
            identifier = (await generateIdentifier(selectedSource.uuid, signal)).data.identifier;
            transactionManager.generatedIdentifiers[identifierFieldName] = identifier;
          }
        }

        const identifierToCreate = {
          uuid: identifierUuid,
          identifier,
          identifierType: identifierTypeUuid,
          location,
          preferred,
        };

        if (!isNewPatient) {
          const state = initializeIdentifierRow(identifierFieldName, initialIdentifierValues?.[identifierFieldName]);

          if (!state.existsOnServer) {
            const response = await addPatientIdentifier(
              patientUuid,
              { ...identifierToCreate, uuid: undefined },
              signal,
            );
            state.existsOnServer = true;
            state.persistedValue = identifier;
            state.resourceUuid = response?.data?.uuid;
          } else if (state.persistedValue !== identifier) {
            if (!state.resourceUuid) {
              throw registrationError(
                `No se puede modificar el identificador ${identifierFieldName} durante este reintento. Recargue el paciente e intente nuevamente.`,
              );
            }
            await updatePatientIdentifier(patientUuid, state.resourceUuid, identifierToCreate.identifier, signal);
            state.persistedValue = identifier;
          }

          identifierToCreate.uuid = state.resourceUuid;
        }

        return identifierToCreate;
      });

    /*
      If there was initially an identifier assigned to the patient,
      which is now not present in the patientIdentifiers(values.identifiers),
      this means that the identifier is meant to be deleted, hence we need
      to delete the respective identifiers.
    */

    const identifiers = await Promise.all(identifierTypeRequests);

    if (patientUuid && !isNewPatient) {
      for (const [identifierFieldName, state] of Object.entries(transactionManager.identifierRows)) {
        if (!state.existsOnServer || activeIdentifierFields.has(identifierFieldName)) {
          continue;
        }
        if (!state.resourceUuid) {
          throw registrationError(
            `No se puede eliminar el identificador ${identifierFieldName} durante este reintento. Recargue el paciente e intente nuevamente.`,
          );
        }
        if (!transactionManager.deletedIdentifierUuids[state.resourceUuid]) {
          await deletePatientIdentifier(patientUuid, state.resourceUuid, signal);
          transactionManager.deletedIdentifierUuids[state.resourceUuid] = true;
        }
        state.existsOnServer = false;
        state.persistedValue = undefined;
        state.resourceUuid = undefined;
      }
    }

    return identifiers;
  }

  static getDeletedNames(values: FormValues, patientUuidMap: PatientUuidMapType) {
    if (!values.addNameInLocalLanguage && patientUuidMap?.additionalNameUuid) {
      return [
        {
          nameUuid: patientUuidMap.additionalNameUuid,
          personUuid: values.patientUuid,
        },
      ];
    }
    return [];
  }

  static getPatientToCreate(
    _isNewPatient: boolean,
    values: FormValues,
    patientUuidMap: PatientUuidMapType,
    _initialAddressFieldValues: Record<string, unknown>,
    identifiers: Array<PatientIdentifier>,
    config?: RegistrationConfig,
  ): Patient {
    let birthdate: string;
    if (values.birthdate instanceof Date) {
      const y = values.birthdate.getFullYear();
      const m = String(values.birthdate.getMonth() + 1).padStart(2, '0');
      const d = String(values.birthdate.getDate()).padStart(2, '0');
      birthdate = `${y}-${m}-${d}`;
    } else {
      birthdate = values.birthdate;
    }

    return {
      uuid: values.patientUuid,
      person: {
        uuid: values.patientUuid,
        names: FormManager.getNames(values, patientUuidMap),
        gender: values.gender.charAt(0).toUpperCase(),
        birthdate,
        birthdateEstimated: values.birthdateEstimated,
        attributes: FormManager.getPatientAttributes(values, patientUuidMap),
        addresses: FormManager.getPatientAddresses(values, patientUuidMap, _initialAddressFieldValues),
        ...FormManager.getPatientDeathInfo(values, config),
      },
      identifiers,
    };
  }

  static getPatientAddresses(
    values: FormValues,
    patientUuidMap: PatientUuidMapType,
    initialAddressFieldValues: Record<string, unknown> = {},
  ): Array<PatientAddress> {
    const initialResidenceAddress = initialAddressFieldValues.address as FormValues['address'] | undefined;
    const initialBirthAddress = initialAddressFieldValues.birthAddress as FormValues['birthAddress'] | undefined;
    const residenceAddress: PatientAddress = {
      ...FormManager.getAddressValuesToPersist(values.address, initialResidenceAddress),
      uuid: patientUuidMap.preferredAddressUuid,
      preferred: true,
    };

    const shouldPersistBirthAddress = hasAddressContent(values.birthAddress) || !!patientUuidMap.birthAddressUuid;
    if (!shouldPersistBirthAddress) {
      return [residenceAddress];
    }

    return [
      residenceAddress,
      {
        ...FormManager.getAddressValuesToPersist(values.birthAddress, initialBirthAddress),
        uuid: patientUuidMap.birthAddressUuid,
        preferred: false,
        [birthAddressMarkerField]: birthAddressMarker,
      },
    ];
  }

  static getAddressValuesToPersist(
    currentAddress: FormValues['address'] | undefined,
    initialAddress: FormValues['address'] | undefined,
  ): Partial<Record<AddressProperties, string>> {
    const currentValues = cleanAddress(currentAddress);
    const clearedValues = Object.fromEntries(
      Object.keys(initialAddress ?? {})
        .filter((field) => typeof currentAddress?.[field] === 'string' && !currentAddress[field].trim())
        .map((field) => [field, '']),
    );
    return { ...currentValues, ...clearedValues } as Partial<Record<AddressProperties, string>>;
  }

  static getNames(values: FormValues, patientUuidMap: PatientUuidMapType) {
    const names = [
      {
        uuid: patientUuidMap.preferredNameUuid,
        preferred: true,
        givenName: values.givenName,
        middleName: values.middleName,
        familyName: values.familyName,
        familyName2: values.familyName2,
      },
    ];

    if (values.addNameInLocalLanguage) {
      names.push({
        uuid: patientUuidMap.additionalNameUuid,
        preferred: false,
        givenName: values.additionalGivenName,
        middleName: values.additionalMiddleName,
        familyName: values.additionalFamilyName,
        familyName2: values.additionalFamilyName2,
      });
    }

    return names;
  }

  static getPatientAttributes(values: FormValues, patientUuidMap: PatientUuidMapType = {}) {
    const attributes: Array<AttributeValue> = [];
    if (values.attributes) {
      Object.entries(values.attributes)
        .filter(([key, value]) => isValidAttributeTypeKey(key) && !!value)
        .forEach(([key, value]) => {
          const attributeUuid = patientUuidMap[`attribute.${key}`];
          attributes.push({
            attributeType: key,
            ...(attributeUuid ? { uuid: attributeUuid } : {}),
            value,
          });
        });
    }

    return attributes;
  }

  static async deleteRemovedPatientAttributes(
    isNewPatient: boolean,
    values: FormValues,
    patientUuidMap: PatientUuidMapType,
    transactionManager: SavePatientTransactionManager,
    signal?: AbortSignal,
  ) {
    if (isNewPatient || !values.patientUuid) {
      return;
    }

    for (const [attributeTypeUuid, value] of Object.entries(values.attributes ?? {})) {
      if (!isValidAttributeTypeKey(attributeTypeUuid) || value) {
        continue;
      }

      const attributeUuid = patientUuidMap[`attribute.${attributeTypeUuid}`] as string | undefined;
      if (!attributeUuid || transactionManager.deletedAttributeUuids[attributeUuid]) {
        continue;
      }

      await deletePersonAttribute(values.patientUuid, attributeUuid, signal);
      transactionManager.deletedAttributeUuids[attributeUuid] = true;
    }
  }

  static getPatientDeathInfo(values: FormValues, config?: RegistrationConfig) {
    const { isDead, deathDate, deathTime, deathTimeFormat, deathCause, nonCodedCauseOfDeath } = values;

    if (!isDead) {
      return {
        dead: false,
      };
    }
    const dateTimeOfDeath = toOmrsIsoString(getDatetime(deathDate, deathTime, deathTimeFormat));

    return {
      dead: true,
      deathDate: dateTimeOfDeath,
      ...(deathCause === config?.freeTextFieldConceptUuid
        ? { causeOfDeathNonCoded: nonCodedCauseOfDeath, causeOfDeath: null }
        : { causeOfDeath: deathCause, causeOfDeathNonCoded: null }),
    };
  }

  static mapPatientToFhirPatient(patient: Partial<Patient>, config?: RegistrationConfig): fhir.Patient {
    // Important:
    // When changing this code, ideally assume that `patient` can be missing any attribute.
    // The `fhir.Patient` provides us with the benefit that all properties are nullable and thus
    // not required (technically, at least). -> Even if we cannot map some props here, we still
    // provide a valid fhir.Patient object. The various patient chart modules should be able to handle
    // such missing props correctly (and should be updated if they don't).

    // Mapping inspired by:
    // https://github.com/openmrs/openmrs-module-fhir/blob/669b3c52220bb9abc622f815f4dc0d8523687a57/api/src/main/java/org/openmrs/module/fhir/api/util/FHIRPatientUtil.java#L36
    // https://github.com/openmrs/openmrs-esm-patient-management/blob/94e6f637fb37cf4984163c355c5981ea6b8ca38c/packages/esm-patient-search-app/src/patient-search-result/patient-search-result.component.tsx#L21
    // Update as required.
    const fieldDefinitions = config?.fieldDefinitions ?? [];
    const phoneAttributeTypeUuid = config?.fieldConfigurations?.phone?.personAttributeUuid;
    const mobilePhoneAttributeTypeUuid = fieldDefinitions.find((field) => field.id === 'mobilePhone')?.uuid;
    const emailAttributeTypeUuid = fieldDefinitions.find((field) => field.id === 'email')?.uuid;
    const phoneAttributeValue =
      getPersonAttributeValue(patient, phoneAttributeTypeUuid) ??
      patient.person?.attributes?.find(
        (attribute) =>
          !!attribute.value &&
          (attribute.attributeType === phoneAttributeTypeUuid || attribute.attributeType === 'Telephone Number'),
      )?.value;
    const mobilePhoneAttributeValue = getPersonAttributeValue(patient, mobilePhoneAttributeTypeUuid);
    const emailAttributeValue = getPersonAttributeValue(patient, emailAttributeTypeUuid);
    const telecom = [
      phoneAttributeValue ? { system: 'phone' as const, use: 'home' as const, value: phoneAttributeValue } : null,
      mobilePhoneAttributeValue
        ? { system: 'phone' as const, use: 'mobile' as const, value: mobilePhoneAttributeValue }
        : null,
      emailAttributeValue ? { system: 'email' as const, value: emailAttributeValue } : null,
    ].filter(Boolean);

    return {
      id: patient.uuid,
      gender: patient.person?.gender,
      birthDate: patient.person?.birthdate,
      deceasedBoolean: patient.person?.dead,
      deceasedDateTime: patient.person?.deathDate,
      name: patient.person?.names?.map((name) => ({
        given: [name.givenName, name.middleName].filter(Boolean),
        family: name.familyName,
        text: [name.familyName, name.familyName2, name.givenName, name.middleName].filter(Boolean).join(' '),
        ...(name.familyName2 ? { extension: [{ url: familyName2ExtensionUrl, valueString: name.familyName2 }] } : {}),
      })),
      address: patient.person?.addresses?.map((address) => ({
        id: address.uuid,
        city: address.cityVillage,
        country: address.country,
        district: address.countyDistrict,
        postalCode: address.postalCode,
        state: address.stateProvince,
        use: address.preferred === false ? 'old' : 'home',
        extension: getAddressExtensions(address),
      })),
      telecom: telecom.length ? telecom : undefined,
    };
  }
}

export class SavePatientTransactionManager {
  deletedAttributeUuids: Record<string, boolean> = {};
  deletedIdentifierUuids: Record<string, boolean> = {};
  deletedNameUuids: Record<string, boolean> = {};
  generatedIdentifiers: Record<string, string> = {};
  identifierRows: Record<string, IdentifierTransactionState> = {};
  newPatientIdentifierSignature?: string;
  observationsSaved = false;
  patientPayloadSignature?: string;
  patientSaved = false;
  photoSaved = false;
  promotionAttributes: Array<AttributeValue> = [];
  promotionCompleted = false;
  promotionPatientUuidMap?: PatientUuidMapType;
  relationshipRows: Record<string, RelationshipTransactionState> = {};
  savedPatientUuid?: string;
}
