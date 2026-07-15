import {
  getDefaultsFromConfigSchema,
  useConfig,
  useFeatureFlag,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { mockLocationsResponse, mockSessionDataResponse } from 'test-utils';

import { type ChartConfig, esmPatientChartSchema } from '../../config-schema';

import LocationSelector from './location-selector.component';
import { type VisitFormData } from './visit-form.resource';

const mockSession = vi.mocked(useSession);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseLocations = vi.mocked(useLocations);
const mockUseConfig = vi.mocked(useConfig<ChartConfig>);

mockSession.mockReturnValue(mockSessionDataResponse.data);

beforeEach(() => {
  mockUseConfig.mockReturnValue({
    ...getDefaultsFromConfigSchema(esmPatientChartSchema),
  });
  mockUseFeatureFlag.mockReturnValue(true);
});

describe('tests location selector', () => {
  it('renders a paragraph with the location name if disableChangingVisitLocation is truthy', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      disableChangingVisitLocation: true,
      restrictByVisitLocationTag: false,
    });

    renderLocationSelector();

    expect(screen.getByText(/ubicación de la consulta/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Inpatient Ward')).toBeInTheDocument();
  });

  it('renders a combobox with options to pick from if disableChangingVisitLocation is falsy', () => {
    renderLocationSelector();

    expect(screen.getByRole('combobox', { name: /select a location/i })).toBeInTheDocument();
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('defaults to showing the session location as the selected location if no locations are available', () => {
    mockUseLocations.mockReturnValue([]);

    renderLocationSelector();

    expect(screen.getByRole('combobox')).toHaveValue('Test Location');
  });

  it('renders a list of locations to pick from if locations are available', async () => {
    const user = userEvent.setup();

    mockUseLocations.mockReturnValue(mockLocationsResponse);

    renderLocationSelector();
    expect(mockUseLocations).toHaveBeenLastCalledWith('Visit Location', '');

    const locationSelector = screen.getByRole('combobox');
    expect(locationSelector).toBeInTheDocument();

    await user.click(locationSelector);

    mockLocationsResponse.forEach((location) => {
      expect(screen.getByRole('option', { name: location.display })).toBeInTheDocument();
    });
  });

  it('should call use locations with Visit Location restriction when restrictByVisitLocationTag set true ', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      restrictByVisitLocationTag: true,
    });

    mockUseLocations.mockReturnValue(mockLocationsResponse);

    renderLocationSelector();
    expect(mockUseLocations).toHaveBeenLastCalledWith('Visit Location', '');
  });
});

function renderLocationSelector() {
  const visitToEdit = {
    uuid: 'visit-uuid',
    location: {
      uuid: 'test-location-uuid',
      display: 'Test Location',
    },
  };

  const App = () => {
    const methods = useForm<VisitFormData>({
      mode: 'all',
      defaultValues: {
        visitLocation: visitToEdit?.location ?? mockSessionDataResponse.data.sessionLocation ?? {},
      },
    });

    return (
      <FormProvider {...methods}>
        <LocationSelector control={methods.control} />
      </FormProvider>
    );
  };

  render(<App />);
}
