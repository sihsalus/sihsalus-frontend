import { age, getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import { getByTextWithMarkup, mockFhirPatient } from 'test-utils';
import { type ConfigObject, configSchema } from '../config-schema';

import PrintIdentifierSticker from './print-identifier-sticker.modal';

const mockedCloseModal = vi.fn();
const mockedUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockedUseReactToPrint = vi.mocked(useReactToPrint);

const defaultConfig: ConfigObject = getDefaultsFromConfigSchema(configSchema);

vi.mock('react-to-print', () => ({
  useReactToPrint: vi.fn(),
}));

vi.mock('react-barcode', () => ({
  default: vi.fn(() => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'barcode' });
  }),
}));

describe('PrintIdentifierStickerModal', () => {
  beforeEach(() => {
    mockedUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  });

  it('renders the print modal', async () => {
    const user = userEvent.setup();
    const mockHandlePrint = vi.fn();
    mockedUseReactToPrint.mockReturnValue(mockHandlePrint);

    renderPrintIdentifierStickerModal();

    expect(screen.getByText(/print identifier sticker/i)).toBeInTheDocument();
    const printButton = screen.getByRole('button', { name: /print/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await user.click(cancelButton);
    expect(mockedCloseModal).toHaveBeenCalledTimes(1);

    await user.click(printButton);
    expect(mockHandlePrint).toHaveBeenCalledTimes(1);
  });

  it('renders a barcode if enabled via config', async () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: true,
          showLogo: true,
          logo: '',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.getByTestId('barcode')).toBeInTheDocument();
    expect(Barcode).toHaveBeenCalledWith(
      {
        value: '100008E',
        width: 2,
        background: '#f4f4f4',
        displayValue: true,
        renderer: 'img',
        font: 'IBM Plex Sans',
        format: 'CODE39',
        textAlign: 'center',
        textPosition: 'bottom',
        fontSize: 16,
      },
      {},
    );
    expect(screen.getByTestId('openmrs-logo')).toBeInTheDocument();
  });

  it("should not render a barcode if it's disabled via config", async () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: false,
          showLogo: false,
          logo: '',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.queryByTestId('barcode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('openmrs-logo')).not.toBeInTheDocument();
  });

  it('renders a custom implementation logo if passed via config', () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: true,
          showLogo: true,
          logo: '/openmrs/spa/logo.png',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.getByRole('img')).toHaveAttribute('src', '/openmrs/spa/logo.png');
  });

  it("renders the patient's details in the print modal", () => {
    renderPrintIdentifierStickerModal();

    expect(getByTextWithMarkup(/Joshua Johnson/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/\+255777053243/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/100008E/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(age(mockFhirPatient.birthDate))).toBeInTheDocument();
  });
});

function renderPrintIdentifierStickerModal() {
  return render(<PrintIdentifierSticker closeModal={mockedCloseModal} patient={mockFhirPatient} />);
}
