import { zodResolver } from '@hookform/resolvers/zod';
import { OperationType } from '../core/api/types/stockOperation/StockOperationType';
import { getStockOperationItemFormSchema } from './validation-schema';

const item = {
  uuid: 'synthetic-operation-item',
  stockItemUuid: 'synthetic-stock-item',
  stockItemPackagingUOMUuid: 'synthetic-packaging-unit',
  quantity: 2,
  hasExpiration: true,
};

it('returns field errors for an incomplete receipt instead of rejecting the resolver promise', async () => {
  const schema = getStockOperationItemFormSchema(OperationType.RECEIPT_OPERATION_TYPE);
  const result = await zodResolver(schema)(item, undefined, { fields: {}, shouldUseNativeValidation: false });

  expect(result.values).toEqual({});
  expect(result.errors).toHaveProperty('batchNo');
  expect(result.errors).toHaveProperty('expiration');
});

it('coerces receipt quantities and dates while retaining the batch and coded identities', () => {
  const schema = getStockOperationItemFormSchema(OperationType.RECEIPT_OPERATION_TYPE);
  expect(schema.parse({ ...item, quantity: '2', expiration: '2030-01-01', batchNo: 'SYNTHETIC-BATCH' })).toEqual({
    ...item,
    expiration: new Date('2030-01-01'),
    batchNo: 'SYNTHETIC-BATCH',
  });
});

it('accepts a requisition without batch fields but rejects missing units and nonpositive quantities', () => {
  const schema = getStockOperationItemFormSchema(OperationType.REQUISITION_OPERATION_TYPE);
  expect(schema.parse(item)).toEqual(item);
  for (const invalid of [
    { ...item, stockItemPackagingUOMUuid: '' },
    { ...item, quantity: 0 },
  ]) {
    expect(schema.safeParse(invalid).success).toBe(false);
  }
});

it.each([
  OperationType.ADJUSTMENT_OPERATION_TYPE,
  OperationType.DISPOSED_OPERATION_TYPE,
  OperationType.STOCK_ISSUE_OPERATION_TYPE,
  OperationType.STOCK_TAKE_OPERATION_TYPE,
  OperationType.RETURN_OPERATION_TYPE,
  OperationType.TRANSFER_OUT_OPERATION_TYPE,
])('requires a selected batch for %s', (operation) => {
  const schema = getStockOperationItemFormSchema(operation);
  expect(schema.safeParse(item).success).toBe(false);
  expect(schema.parse({ ...item, stockBatchUuid: 'synthetic-existing-batch' })).toEqual({
    ...item,
    stockBatchUuid: 'synthetic-existing-batch',
  });
});

it('allows a negative adjustment but rejects zero and negative requisitions', () => {
  const adjustment = getStockOperationItemFormSchema(OperationType.ADJUSTMENT_OPERATION_TYPE);
  expect(adjustment.safeParse({ ...item, stockBatchUuid: 'synthetic-existing-batch', quantity: -2 }).success).toBe(
    true,
  );
  expect(adjustment.safeParse({ ...item, stockBatchUuid: 'synthetic-existing-batch', quantity: 0 }).success).toBe(
    false,
  );
  const requisition = getStockOperationItemFormSchema(OperationType.REQUISITION_OPERATION_TYPE);
  expect(requisition.safeParse({ ...item, quantity: -2 }).success).toBe(false);
});
