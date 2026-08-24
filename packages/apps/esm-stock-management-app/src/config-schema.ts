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
    _default: '162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
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
    _default: 'bce2b1af-98b1-48a2-98a2-3e4ffb3c79c2',
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
    _default: '3bbfaa44-d5b8-404d-b4c1-2bf49ad8ce25',
  },
  stockItemCategoryUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock item category',
    _default: '6d24eb6e-b42f-4706-ab2d-ae4472161f6a',
  },
  stockSourceTypeUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock source types',
    _default: '2e1e8049-9cbe-4a2d-b1e5-8a91e5d7d97d',
  },
  stockTakeReasonUUID: {
    _type: Type.ConceptUuid,
    _description: 'UUID for the stock take reasons',
    _default: '47f0825e-8648-47c2-b847-d3197ed6bb72',
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
