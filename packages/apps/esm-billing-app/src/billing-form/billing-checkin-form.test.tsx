import { useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type BillingConfig } from '../config-schema';
import BillingCheckInForm from './billing-checkin-form.component';
import { usePaymentMethods } from './billing-form.resource';

const mockUseConfig = vi.mocked(useConfig<BillingConfig>);
const mockUsePaymentMethods = vi.mocked(usePaymentMethods);

const mockPaymentMethods = [
  {
    uuid: '1c30ee58-82d4-4ea4-a8c1-4bf2f9dfc8cf',
    name: 'Insurance',
    description: 'Insurance payment',
  },
  {
    uuid: '2c30ee58-82d4-4ea4-a8c1-4bf2f9dfc8cf',
    name: 'Cash',
    description: 'Cash payment',
  },
];

vi.mock('./billing-form.resource', () => ({
  usePaymentMethods: vi.fn(),
}));

const testProps = { patientUuid: 'some-patient-uuid', setExtraVisitInfo: vi.fn() };

describe('BillingCheckInForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseConfig.mockReturnValue({
      patientCategory: {
        paymentDetails: 'fbc0702d-b4c9-4968-be63-af8ad3ad6239',
        paymentMethods: '8553afa0-bdb9-4d3c-8a98-05fa9350aa85',
        policyNumber: '3a988e33-a6c0-4b76-b924-01abb998944b',
        insuranceScheme: 'aac48226-d143-4274-80e0-264db4e368ee',
        patientCategory: '3b9dfac8-9e4d-11ee-8c90-0242ac120002',
        formPayloadPending: '919b51c9-8e2e-468f-8354-181bf3e55786',
      },
      categoryConcepts: {
        payingDetails: '44b34972-6630-4e5a-a9f6-a6eb0f109650',
        nonPayingDetails: 'f3fb2d88-cccd-422c-8766-be101ba7bd2e',
        insuranceDetails: 'beac329b-f1dc-4a33-9e7c-d95821a137a6',
      },
      nonPayingPatientCategories: {
        childUnder5: '1528AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        student: '159465AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    } as BillingConfig);
    mockUsePaymentMethods.mockReturnValue({ paymentModes: mockPaymentMethods, isLoading: false, error: null });
  });

  test('should render the payment form without a billable service selector and generate visit attributes', async () => {
    const user = userEvent.setup();
    renderBillingCheckinForm();

    const paymentTypeSelect = screen.getByRole('group', { name: /payment details/i });
    expect(paymentTypeSelect).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /billable service/i })).not.toBeInTheDocument();

    // Select "Paying" radio button
    const paymentTypeRadio = screen.getByRole('radio', { name: 'Paying' });
    expect(paymentTypeRadio).toBeInTheDocument();
    await user.click(paymentTypeRadio);

    // Wait for payment methods dropdown to appear and select a payment method
    const paymentMethodsDropdown = await screen.findByRole('combobox', { name: /payment method/i });
    expect(paymentMethodsDropdown).toBeInTheDocument();
    await user.click(paymentMethodsDropdown);

    // Select "Insurance" payment method
    const insuranceOption = await screen.findByText('Insurance');
    await user.click(insuranceOption);

    await waitFor(() =>
      expect(testProps.setExtraVisitInfo).toHaveBeenCalledWith({
        attributes: expect.arrayContaining([
          expect.objectContaining({
            attributeType: 'fbc0702d-b4c9-4968-be63-af8ad3ad6239',
            value: '44b34972-6630-4e5a-a9f6-a6eb0f109650',
          }),
          expect.objectContaining({
            attributeType: '8553afa0-bdb9-4d3c-8a98-05fa9350aa85',
            value: '1c30ee58-82d4-4ea4-a8c1-4bf2f9dfc8cf',
          }),
        ]),
      }),
    );
  });
});

function renderBillingCheckinForm() {
  return render(<BillingCheckInForm {...testProps} />);
}
