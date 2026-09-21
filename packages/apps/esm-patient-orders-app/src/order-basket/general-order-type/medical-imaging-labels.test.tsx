import { getDefaultsFromConfigSchema, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { useOrderBasket, useOrderType } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import englishTranslations from '../../../translations/en.json';
import spanishTranslations from '../../../translations/es.json';
import { configSchema } from '../../config-schema';

import GeneralOrderType from './general-order-type.component';
import OrderableConceptSearchWorkspace from './orderable-concept-search/orderable-concept-search.workspace';
import OrderableConceptSearchResults from './orderable-concept-search/search-results.component';

const translationMock = vi.hoisted(() => {
  const values: Record<string, string> = {};
  const t = (key: string, defaultValue?: string | Record<string, string>, options: Record<string, string> = {}) => {
    const replacements = typeof defaultValue === 'object' ? defaultValue : options;
    const fallback = typeof defaultValue === 'string' ? defaultValue : defaultValue?.defaultValue;
    return (values[key] ?? fallback ?? key).replace(/{{(\w+)}}/g, (_match, name: string) => replacements[name] ?? '');
  };
  return { t, values };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translationMock.t }),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useOrderBasket: vi.fn(),
  useOrderType: vi.fn(),
}));

vi.mock('./orderable-concept-search/search-results.component', () => ({
  default: vi.fn(() => null),
}));

const imagingTypeUuid = 'f9c5d0b8-8b5a-11e5-8e9b-12345678a01a';
const defaultConfig = getDefaultsFromConfigSchema(configSchema);

describe('medical imaging order labels', () => {
  beforeEach(() => {
    Object.keys(translationMock.values).forEach((key) => {
      delete translationMock.values[key];
    });
    Object.assign(translationMock.values, englishTranslations);
    vi.mocked(useConfig).mockReturnValue(defaultConfig);
    vi.mocked(useLayoutType).mockReturnValue('small-desktop');
    vi.mocked(useOrderType).mockReturnValue({
      orderType: { uuid: imagingTypeUuid, display: 'Radiology Order' },
      isLoadingOrderType: false,
    } as ReturnType<typeof useOrderType>);
    vi.mocked(useOrderBasket).mockReturnValue({
      orders: [],
      setOrders: vi.fn(),
    } as unknown as ReturnType<typeof useOrderBasket>);
  });

  it.each([
    [englishTranslations, 'Medical imaging orders'],
    [spanishTranslations, 'Órdenes de imágenes médicas'],
  ])('uses the localized category while opening the existing order type', async (translations, label) => {
    Object.assign(translationMock.values, translations);
    const launchOrderableConceptWorkspace = vi.fn();
    const imagingOrderType = defaultConfig.orderTypes.find((type) => type.orderTypeUuid === imagingTypeUuid);

    render(
      <GeneralOrderType
        {...imagingOrderType}
        canCreateOrders
        onMissingActiveVisit={vi.fn()}
        launchOrderableConceptWorkspace={launchOrderableConceptWorkspace}
      />,
    );

    expect(screen.getByRole('heading', { name: `${label} (0)` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${translationMock.values.add}\\b`) }));
    expect(launchOrderableConceptWorkspace).toHaveBeenCalledWith(imagingTypeUuid);
  });

  function renderSearch(orderTypeUuid = imagingTypeUuid) {
    const setTitle = vi.fn();
    const props = {
      orderTypeUuid,
      setTitle,
      closeWorkspace: vi.fn(),
      promptBeforeClosing: vi.fn(),
    } as unknown as React.ComponentProps<typeof OrderableConceptSearchWorkspace>;
    render(<OrderableConceptSearchWorkspace {...props} />);
    return setTitle;
  }

  it('reuses the configured Spanish category in the search title and accessible input', () => {
    Object.assign(translationMock.values, spanishTranslations);
    const setTitle = renderSearch();

    expect(setTitle).toHaveBeenCalledWith('Agregar órdenes de imágenes médicas');
    expect(screen.getByRole('searchbox', { name: 'Buscar en Órdenes de imágenes médicas' })).toBeInTheDocument();
    expect(vi.mocked(OrderableConceptSearchResults).mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ orderTypeUuid: imagingTypeUuid, orderableConceptSets: [] }),
    );
    expect(screen.queryByText(/radiology order/i)).not.toBeInTheDocument();
  });

  it('respects an institutional label override', () => {
    vi.mocked(useConfig).mockReturnValue({
      ...defaultConfig,
      orderTypes: [{ orderTypeUuid: imagingTypeUuid, label: 'Estudios del hospital', orderableConceptSets: [] }],
    });
    const setTitle = renderSearch();

    expect(setTitle).toHaveBeenCalledWith('Add estudios del hospital');
    expect(screen.getByRole('searchbox', { name: 'Search Estudios del hospital' })).toBeInTheDocument();
  });

  it('keeps the backend display for order types without a configured label', () => {
    vi.mocked(useOrderType).mockReturnValue({
      orderType: { uuid: 'external-order-type', display: 'External studies' },
      isLoadingOrderType: false,
    } as ReturnType<typeof useOrderType>);
    const setTitle = renderSearch('external-order-type');

    expect(setTitle).toHaveBeenCalledWith('Add external studies');
    expect(screen.getByRole('searchbox', { name: 'Search External studies' })).toBeInTheDocument();
  });
});
