import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  concepts: {
    systolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    diastolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    pulseUuid: {
      _type: Type.ConceptUuid,
      _default: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    temperatureUuid: {
      _type: Type.ConceptUuid,
      _default: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    oxygenSaturationUuid: {
      _type: Type.ConceptUuid,
      _default: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    heightUuid: {
      _type: Type.ConceptUuid,
      _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    weightUuid: {
      _type: Type.ConceptUuid,
      _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    respiratoryRateUuid: {
      _type: Type.ConceptUuid,
      _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    generalPatientNoteUuid: {
      _type: Type.ConceptUuid,
      _default: '165095AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    midUpperArmCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _default: '1343AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    abdominalCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _default: '18fcbd1f-5b4f-44ed-a664-8637a83cc7eb',
    },
    headCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _default: 'c4d39248-c896-433a-bc69-e24d04b7f0e5',
    },
    chestCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _default: '911eb398-e7de-4270-af63-e4c615ec22a9',
    },
    bodyMassIndexUuid: {
      _type: Type.ConceptUuid,
      _default: '5b877648-ae50-4d45-ad36-0196042baa1a',
    },
    vitalSignsConceptSetUuid: {
      _type: Type.ConceptUuid,
      _default: '1114AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    glasgowEyeOpeningUuid: {
      _type: Type.ConceptUuid,
      _default: '7e540048-19b4-4261-af10-3b20712a92ef',
      _description: 'Coded concept UUID used to store the Glasgow Coma Scale eye-opening response.',
    },
    glasgowVerbalResponseUuid: {
      _type: Type.ConceptUuid,
      _default: '67f9449e-e7ef-436c-9eb7-837b5afe30e4',
      _description: 'Coded concept UUID used to store the Glasgow Coma Scale verbal response.',
    },
    glasgowMotorResponseUuid: {
      _type: Type.ConceptUuid,
      _default: '98bfda0d-2a22-4ca4-8bc9-b0b6c6505899',
      _description: 'Coded concept UUID used to store the Glasgow Coma Scale motor response.',
    },
    glasgowTotalUuid: {
      _type: Type.ConceptUuid,
      _default: '9ba86e50-a4fd-48b7-b8b2-f537fde5a382',
      _description: 'Concept UUID used to store the computed Glasgow Coma Scale total score.',
    },
  },
  vitals: {
    useFormEngine: {
      _type: Type.Boolean,
      _default: false,
      _description:
        'Whether to use the form engine for vitals and biometrics. If set to true, formUuid must be configured (formName is optional).',
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: '67a71486-1a54-468f-ac3e-7091a9a79584',
    },
    encounterRoleUuid: {
      _type: Type.UUID,
      _default: 'a0b03050-c99b-11e0-9572-0800200c9a66',
      _description:
        'Encounter role used when attributing the session provider to a vitals encounter. Defaults to the OpenMRS "Unknown" encounter role.',
    },
    vitalsOverdueThresholdHours: {
      _type: Type.Number,
      _default: 12,
      _description: 'Hours at or above which vitals are considered overdue',
    },
    logo: {
      src: {
        _type: Type.String,
        _default: '',
        _description: 'A path or URL to an image. Defaults to the OpenMRS SVG sprite.',
      },
      alt: {
        _type: Type.String,
        _default: 'Logo',
        _description: 'Alt text, shown on hover',
      },
      name: {
        _type: Type.String,
        _default: '',
        _description: 'The organization name displayed when image is absent',
      },
    },
    showPrintButton: {
      _type: Type.Boolean,
      _default: false,
      _description:
        'Determines whether or not to display the Print button in the vitals datatable header. If set to true, a Print button gets shown as the right-most item in the table header. When clicked, this button enables the user to print out the contents of the table',
    },
    formUuid: {
      _type: Type.UUID,
      _default: '9f26aad4-244a-46ca-be49-1196df1a8c9a',
    },
    formName: {
      _type: Type.String,
      _default: 'Vitals',
    },
    formEntryWorkspaceName: {
      _type: Type.String,
      _default: 'patient-form-entry-workspace',
      _description: 'Workspace name used when launching the form engine vitals form.',
    },
    useMuacColors: {
      _type: Type.Boolean,
      _default: false,
      _description: 'Whether to show/use MUAC color codes. If set to true, the input will show status colors.',
    },
    glasgowComaScale: {
      enabled: {
        _type: Type.Boolean,
        _default: true,
        _description:
          'Whether the shared vitals workspace may render Glasgow Coma Scale fields when launched with an emergency triage profile.',
      },
      answerUuids: {
        _description:
          'Concept answer UUIDs for each Glasgow Coma Scale response. Scores are fixed by the scale itself; only the UUIDs vary per installation.',
        eyeOpeningSpontaneous: {
          _type: Type.UUID,
          _default: 'faff1dec-14df-44d4-8695-b337dced2274',
        },
        eyeOpeningToSpeech: {
          _type: Type.UUID,
          _default: '2120199e-03ed-4986-892f-52a3d13b92c0',
        },
        eyeOpeningToPain: {
          _type: Type.UUID,
          _default: '1633ea34-bc65-4a87-9fec-8fef231b85cf',
        },
        eyeOpeningNone: {
          _type: Type.UUID,
          _default: '8b4ee185-b709-4cfa-b3db-f15d565ddc04',
        },
        eyeOpeningNotTestable: {
          _type: Type.UUID,
          _default: '25c71769-dddb-4d06-a858-cde05e2087e2',
        },
        verbalResponseOriented: {
          _type: Type.UUID,
          _default: '6440f83b-657e-4c5c-bac5-e3f67660ea4e',
        },
        verbalResponseConfused: {
          _type: Type.UUID,
          _default: '52066114-63ee-48ca-a09b-fa9c0c7f73ba',
        },
        verbalResponseInappropriateWords: {
          _type: Type.UUID,
          _default: '0b5820f1-f968-4950-bc62-ad54c6166723',
        },
        verbalResponseIncomprehensibleSounds: {
          _type: Type.UUID,
          _default: '245c6329-b810-4db3-bdc1-62bb9cdc0f31',
        },
        verbalResponseNone: {
          _type: Type.UUID,
          _default: '1d01f180-1acd-4121-b380-049f4bbb4af7',
        },
        verbalResponseNotTestable: {
          _type: Type.UUID,
          _default: 'fd4b9335-0f74-453e-b787-46d303a9b3b5',
        },
        motorResponseObeysCommands: {
          _type: Type.UUID,
          _default: 'bddbf4e2-c870-4515-924e-d98cfcb7948f',
        },
        motorResponseLocalizesPain: {
          _type: Type.UUID,
          _default: '355eb0e2-c319-4536-9837-43bf3c23f592',
        },
        motorResponseWithdrawsFromPain: {
          _type: Type.UUID,
          _default: 'a815a9d0-a033-48bc-89e9-836a15b9a3b2',
        },
        motorResponseAbnormalFlexion: {
          _type: Type.UUID,
          _default: '795e56c8-e783-470e-8b83-3ee11300f4a7',
        },
        motorResponseExtension: {
          _type: Type.UUID,
          _default: 'b4e10f1d-09e2-4b6b-8471-466c25da1b79',
        },
        motorResponseNone: {
          _type: Type.UUID,
          _default: '7e16856d-c686-4921-ba7f-65f7bf15771a',
        },
        motorResponseNotTestable: {
          _type: Type.UUID,
          _default: '09957de5-8eb7-4865-8e29-e946cf895bc4',
        },
      },
    },
  },
  biometrics: {
    bmiUnit: {
      _type: Type.String,
      _default: 'kg / m²',
    },
    abdominalCircumferenceUnit: {
      _type: Type.String,
      _default: 'cm',
    },
    bmiMinimumAge: {
      _type: Type.Number,
      _default: 0,
      _description: 'The minimum age (in years) required to display BMI. Set to 0 to show BMI for all patients.',
    },
    headCircumference: {
      enabled: {
        _type: Type.Boolean,
        _default: true,
        _description: 'Whether the head circumference field is available in the vitals and biometrics form.',
      },
      minAgeDays: {
        _type: Type.Number,
        _default: 0,
      },
      maxAgeDays: {
        _type: Type.Number,
        _default: 4380,
        _description:
          'Hide the field for patients older than this age in days. The default covers the CRED range (NTS N.° 238-MINSA/DGIESP-2025): birth to 11 years, 11 months and 29 days.',
      },
      unit: {
        _type: Type.String,
        _default: 'cm',
        _description: 'Fallback unit symbol when the concept does not define one.',
      },
    },
    chestCircumference: {
      enabled: {
        _type: Type.Boolean,
        _default: true,
        _description: 'Whether the chest circumference field is available in the vitals and biometrics form.',
      },
      minAgeDays: {
        _type: Type.Number,
        _default: 0,
      },
      maxAgeDays: {
        _type: Type.Number,
        _default: 365,
        _description:
          'Hide the field for patients older than this age in days. Chest circumference is routinely measured during the first year of life.',
      },
      unit: {
        _type: Type.String,
        _default: 'cm',
        _description: 'Fallback unit symbol when the concept does not define one.',
      },
    },
  },
};

export interface GlasgowComaScaleAnswerUuids {
  eyeOpeningSpontaneous: string;
  eyeOpeningToSpeech: string;
  eyeOpeningToPain: string;
  eyeOpeningNone: string;
  eyeOpeningNotTestable: string;
  verbalResponseOriented: string;
  verbalResponseConfused: string;
  verbalResponseInappropriateWords: string;
  verbalResponseIncomprehensibleSounds: string;
  verbalResponseNone: string;
  verbalResponseNotTestable: string;
  motorResponseObeysCommands: string;
  motorResponseLocalizesPain: string;
  motorResponseWithdrawsFromPain: string;
  motorResponseAbnormalFlexion: string;
  motorResponseExtension: string;
  motorResponseNone: string;
  motorResponseNotTestable: string;
}

export interface ConditionalBiometricFieldConfig {
  enabled: boolean;
  minAgeDays: number;
  maxAgeDays: number;
  unit: string;
}

export interface BiometricsConfigObject {
  abdominalCircumferenceUnit: string;
  bmiUnit: string;
  heightUnit: string;
  weightUnit: string;
  bmiMinimumAge: number;
  headCircumference: ConditionalBiometricFieldConfig;
  chestCircumference: ConditionalBiometricFieldConfig;
}

export interface ConfigObject {
  concepts: {
    systolicBloodPressureUuid: string;
    diastolicBloodPressureUuid: string;
    pulseUuid: string;
    temperatureUuid: string;
    oxygenSaturationUuid: string;
    heightUuid: string;
    weightUuid: string;
    respiratoryRateUuid: string;
    generalPatientNoteUuid: string;
    midUpperArmCircumferenceUuid: string;
    abdominalCircumferenceUuid: string;
    headCircumferenceUuid: string;
    chestCircumferenceUuid: string;
    bodyMassIndexUuid: string;
    vitalSignsConceptSetUuid: string;
    glasgowEyeOpeningUuid: string;
    glasgowVerbalResponseUuid: string;
    glasgowMotorResponseUuid: string;
    glasgowTotalUuid: string;
  };
  vitals: {
    useFormEngine: boolean;
    encounterTypeUuid: string;
    encounterRoleUuid: string;
    vitalsOverdueThresholdHours: number;
    logo: {
      src: string;
      alt: string;
      name: string;
    };
    formUuid: string;
    formName: string;
    formEntryWorkspaceName: string;
    useMuacColors: boolean;
    showPrintButton: boolean;
    glasgowComaScale: {
      enabled: boolean;
      answerUuids: GlasgowComaScaleAnswerUuids;
    };
  };
  biometrics: BiometricsConfigObject;
}
