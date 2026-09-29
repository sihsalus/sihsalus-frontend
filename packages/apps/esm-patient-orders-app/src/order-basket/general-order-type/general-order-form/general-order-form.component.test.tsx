import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { type OrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSessionDataResponse } from 'test-utils';
import { configSchema } from '../../../config-schema';
import { OrderForm } from './general-order-form.component';

const mocks = vi.hoisted(() => ({ setOrders: vi.fn(), useOrderBasket: vi.fn() }));
vi.mock('@openmrs/esm-patient-common-lib', async (original) => ({
  ...(await original()),
  useOrderBasket: mocks.useOrderBasket,
  useOrderType: () => ({ orderType: { display: 'Synthetic order' } }),
}));

const initialOrder: OrderBasketItem = {
  action: 'NEW',
  display: 'Synthetic order',
  uuid: 'synthetic-order',
  concept: { uuid: 'synthetic-concept', display: 'Synthetic concept' },
  urgency: 'ROUTINE',
  orderType: 'synthetic-order-type',
  isOrderIncomplete: true,
};
const otherOrder: OrderBasketItem = {
  ...initialOrder,
  uuid: 'synthetic-other-order',
  concept: { uuid: 'synthetic-other-concept', display: 'Synthetic other concept' },
};

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    ...getDefaultsFromConfigSchema(configSchema),
    priorityConfigs: [{ conceptUuid: 'ROUTINE', label: 'Routine', urgency: 'ROUTINE' }],
  });
  vi.mocked(useSession).mockReturnValue(mockSessionDataResponse.data);
  mocks.useOrderBasket.mockReturnValue({ orders: [initialOrder, otherOrder], setOrders: mocks.setOrders });
});

function renderForm(order = initialOrder) {
  const returnToOrderBasket = vi.fn();
  render(
    <OrderForm
      initialOrder={order}
      orderTypeUuid="synthetic-order-type"
      orderableConceptSets={[]}
      promptBeforeClosing={vi.fn()}
      returnToOrderBasket={returnToOrderBasket}
    />,
  );
  return returnToOrderBasket;
}

it('discards only the selected concept from the basket', async () => {
  const returnToOrderBasket = renderForm();
  await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(mocks.setOrders).toHaveBeenCalledWith([otherOrder]);
  expect(returnToOrderBasket).toHaveBeenCalledWith(true);
});

it('retains order metadata when saving the validated form fields', async () => {
  renderForm();
  await userEvent.click(screen.getByRole('button', { name: 'Save order' }));
  await waitFor(() => expect(mocks.setOrders).toHaveBeenCalled());
  expect(mocks.setOrders).toHaveBeenCalledWith([
    expect.objectContaining({
      uuid: initialOrder.uuid,
      action: 'NEW',
      orderType: initialOrder.orderType,
      concept: initialOrder.concept,
      urgencyCode: 'ROUTINE',
      isOrderIncomplete: false,
    }),
    otherOrder,
  ]);
});

it('shows validation feedback and keeps the basket unchanged for an invalid order', async () => {
  renderForm({ ...initialOrder, concept: null });
  await userEvent.click(screen.getByRole('button', { name: 'Save order' }));
  expect(await screen.findByText('Please fill all required fields.')).toBeInTheDocument();
  expect(mocks.setOrders).not.toHaveBeenCalled();
});
