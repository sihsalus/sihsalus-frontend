import { configSchema } from './config-schema';

describe('Stock Management catalog configuration', () => {
  it('uses the SIH Salus content catalog UUIDs by default', () => {
    expect({
      packingUnitsUUID: configSchema.packingUnitsUUID._default,
      dispensingUnitsUUID: configSchema.dispensingUnitsUUID._default,
      stockAdjustmentReasonUUID: configSchema.stockAdjustmentReasonUUID._default,
      stockTakeReasonUUID: configSchema.stockTakeReasonUUID._default,
      stockSourceTypeUUID: configSchema.stockSourceTypeUUID._default,
      stockItemCategoryUUID: configSchema.stockItemCategoryUUID._default,
    }).toEqual({
      packingUnitsUUID: 'bce2b1af-98b1-48a2-98a2-3e4ffb3c79c2',
      dispensingUnitsUUID: '162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      stockAdjustmentReasonUUID: '3bbfaa44-d5b8-404d-b4c1-2bf49ad8ce25',
      stockTakeReasonUUID: '47f0825e-8648-47c2-b847-d3197ed6bb72',
      stockSourceTypeUUID: '2e1e8049-9cbe-4a2d-b1e5-8a91e5d7d97d',
      stockItemCategoryUUID: '6d24eb6e-b42f-4706-ab2d-ae4472161f6a',
    });
  });
});
