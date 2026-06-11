import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  contactAttributeTypes: {
    _type: Type.Array,
    _description: 'The UUIDs of person attribute types that store contact information',
    _default: [
      '14d4f066-15f5-102d-96e4-000c29c2a5d7',
      'fee4e8ef-aef8-4bb9-8ed0-7ded6055c61f',
      '4bdf3a33-2f63-11f0-8ab4-1a7535b1b3e8',
    ],
    _elements: {
      _type: Type.UUID,
    },
  },
  additionalAttributeTypes: {
    _type: Type.Array,
    _description: 'The UUIDs of person attribute types to display in the expanded patient banner details',
    _default: [
      '9b3df0a1-0c58-4f55-9868-9c38f1db1007',
      '8d8718c2-c2cc-11de-8d13-0010c6dffd0f',
      '8d871f2a-c2cc-11de-8d13-0010c6dffd0f',
      '8d871386-c2cc-11de-8d13-0010c6dffd0f',
      '8d872150-c2cc-11de-8d13-0010c6dffd0f',
      '8d871afc-c2cc-11de-8d13-0010c6dffd0f',
      '8d87236c-c2cc-11de-8d13-0010c6dffd0f',
      '77bbb234-2312-4644-99d0-fa894d438817',
      '9b3df0a1-0c58-4f55-9868-9c38f1db1001',
      '9b3df0a1-0c58-4f55-9868-9c38f1db1002',
      '56188294-b42c-481d-a987-4b495116c580',
      '374b130f-7457-476f-87b1-f182aa77c434',
      '9b3df0a1-0c58-4f55-9868-9c38f1db1005',
    ],
    _elements: {
      _type: Type.UUID,
    },
  },
  ethnicIdentityConceptUuid: {
    _type: Type.ConceptUuid,
    _description: 'Ethnic self-identification concept UUID displayed in the expanded patient banner details',
    _default: '160581AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  ethnicIdentityAttributeTypeUuid: {
    _type: Type.UUID,
    _description: 'Person attribute type UUID that stores ethnicity displayed in the expanded patient banner details',
    _default: '8d871386-c2cc-11de-8d13-0010c6dffd0f',
  },
  birthplaceAttributeTypeUuid: {
    _type: Type.UUID,
    _description: 'Person attribute type UUID that stores birthplace displayed in the expanded patient banner details',
    _default: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f',
  },
  occupationAttributeTypeUuid: {
    _type: Type.UUID,
    _description: 'Person attribute type UUID that stores occupation displayed in the expanded patient banner details',
    _default: '8d871afc-c2cc-11de-8d13-0010c6dffd0f',
  },
  printPatientSticker: {
    header: {
      _type: Type.Object,
      _description: 'Configuration properties for patient identifier stickers',
      showBarcode: {
        _type: Type.Boolean,
        _description: 'Whether to display a barcode on the patient sticker',
      },
      showLogo: {
        _type: Type.Boolean,
        _description: 'Whether to display a logo on the patient sticker',
      },
      logo: {
        _type: Type.String,
        _description: 'The URL of the logo to display in the patient sticker',
      },
      _default: {
        showBarcode: true,
        showLogo: true,
        logo: '',
      },
    },
    fields: {
      _type: Type.Array,
      _description: 'Patient demographics to include in the patient sticker printout',
      _default: ['name', 'dob', 'gender', 'identifier', 'age', 'contact', 'address'],
    },
    pageSize: {
      _type: Type.String,
      _description:
        'Specifies the paper size for printing the sticker. You can define the size using units (e.g., mm, in) or named sizes (e.g., "148mm 210mm", "A1", "A2", "A4", "A5").',
      _default: 'A4',
    },
    printScale: {
      _type: Type.String,
      _description:
        'Set the scale for the printed content. A value between 0 and 1 shrinks the content, while a value greater than 1 enlarges it. The scale must be greater than 0.',
      _default: '1',
    },
    identifiersToDisplay: {
      _type: Type.Array,
      _description:
        'List of UUIDs of patient identifier types to include on the patient sticker. If empty, all identifiers will be displayed.',
      _default: [],
      _elements: {
        _type: Type.UUID,
      },
    },
  },
  useRelationshipNameLink: {
    _type: Type.Boolean,
    _description: "Whether to use the relationship name as a link to the associated person's patient chart.",
    _default: false,
  },
};

export type AllowedPatientFields = 'address' | 'age' | 'contact' | 'dob' | 'gender' | 'identifier' | 'name';

export interface ConfigObject {
  contactAttributeTypes: Array<string>;
  additionalAttributeTypes: Array<string>;
  birthplaceAttributeTypeUuid: string;
  ethnicIdentityConceptUuid: string;
  ethnicIdentityAttributeTypeUuid: string;
  occupationAttributeTypeUuid: string;
  printPatientSticker: {
    header: {
      showBarcode: boolean;
      showLogo: boolean;
      logo: string;
    };
    fields: Array<AllowedPatientFields>;
    pageSize: string;
    printScale: string;
    identifiersToDisplay: Array<string>;
  };
  useRelationshipNameLink: boolean;
}
