import { Type } from '@openmrs/esm-framework';
export const configSchema = {
  autoPopulateResponsiblePerson: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Auto-populate responsible person in stock operations with the currently logged-in user',
  },
  dispensingUnitsUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock dispensing units',
    _default: '62985ffa-b5c9-4e14-ad31-bbfa657dd87a',
  },
  enablePrintButton: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Enable or disable the print button in the stock management UI',
  },
  logo: {
    src: {
      _type: Type.String,
      _default: null,
      _description: 'A path or URL to an image',
    },
    alt: {
      _type: Type.String,
      _default: 'Logo',
      _description: 'Alt text shown on hover',
    },
    name: {
      _type: Type.String,
      _default: null,
      _description: 'The organization name displayed when image is absent',
    },
  },
  packingUnitsUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the packaging unit',
    _default: '62985ffa-b5c9-4e14-ad31-bbfa657dd87a',
  },
  printBalanceOnHand: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Whether to include balance on hand on the printout',
  },
  printItemCost: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Whether to include item costs on the printout',
  },
  stockAdjustmentReasonUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock adjustment reasons',
    _default: 'a8658733-4f9e-4c23-89b5-106d9315114d',
  },
  stockItemCategoryUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock item category',
    _default: '8ccf6066-9297-4d76-aaf3-00aa3714d198',
  },
  stockSourceTypeUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock source types',
    _default: '3ec42d39-8e50-4131-88a7-c5889af7abda',
  },
  stockTakeReasonUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock take reasons',
    _default: '3ec42d39-8e50-4131-88a7-c5889af7abda',
  },
  useItemCommonNameAsDisplay: {
    _type: Type.Boolean,
    _description: 'Use item common name as display (true) or drug name as display (false)',
    _default: true,
  },
};

export type ConfigObject = {
  autoPopulateResponsiblePerson: boolean;
  dispensingUnitsUUID: string;
  enablePrintButton: boolean;
  logo: {
    src: string;
    alt: string;
    name: string;
  };
  packingUnitsUUID: string;
  printBalanceOnHand: boolean;
  printItemCost: boolean;
  stockAdjustmentReasonUUID: string;
  stockItemCategoryUUID: string;
  stockSourceTypeUUID: string;
  stockTakeReasonUUID: string;
  useItemCommonNameAsDisplay: boolean;
};
