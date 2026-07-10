import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';

import { type ChartConfig, esmPatientChartSchema } from '../config-schema';

import VisitAttributeTags from './visit-attribute-tags.component';

const mockUseConfig = vi.mocked(useConfig<ChartConfig>);
const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useVisitOrOfflineVisit: vi.fn(),
}));

describe('VisitAttributeTags', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: 'insurance-scheme-uuid',
          required: false,
          displayInThePatientBanner: true,
        },
        {
          uuid: 'hidden-attribute-uuid',
          required: false,
          displayInThePatientBanner: false,
        },
      ],
    });
  });

  it('renders configured visit attributes for the current visit', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: {
        uuid: 'visit-uuid',
        attributes: [
          {
            uuid: 'attribute-uuid',
            attributeType: {
              uuid: 'insurance-scheme-uuid',
              datatypeClassname: 'org.openmrs.customdatatype.datatype.FreeTextDatatype',
            },
            value: 'SIS Gratuito',
          },
          {
            uuid: 'hidden-attribute-value-uuid',
            attributeType: {
              uuid: 'hidden-attribute-uuid',
              datatypeClassname: 'org.openmrs.customdatatype.datatype.FreeTextDatatype',
            },
            value: 'Hidden',
          },
        ],
      },
    } as unknown as ReturnType<typeof useVisitOrOfflineVisit>);

    render(<VisitAttributeTags patientUuid="patient-uuid" />);

    expect(screen.getByText('SIS Gratuito')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('does not render or throw for voided visits with malformed attributes', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: {
        uuid: 'cancelled-visit-uuid',
        voided: true,
        attributes: [
          {
            uuid: 'malformed-attribute-uuid',
            attributeType: null,
            value: 'SIS Gratuito',
          },
        ],
      },
    } as unknown as ReturnType<typeof useVisitOrOfflineVisit>);

    const { container } = render(<VisitAttributeTags patientUuid="patient-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });
});
