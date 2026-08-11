import { render, screen, waitFor } from '@testing-library/react';

import { type SectionDefinition } from '../../../config-schema';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruLegacySisPlanConceptUuid,
} from '../../peru-registration-config';
import { InsuranceSection } from './insurance-section.component';

vi.mock('../../field/field.component', () => ({
  Field: ({ name }: { name: string }) => <div data-testid={`field-${name}`}>{name}</div>,
}));

const noConsultedInsuranceAccreditationConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2054';

const insuranceSectionDefinition: SectionDefinition = {
  id: 'insurance',
  name: 'Seguro',
  fields: ['insuranceType', 'sisLookup', 'insuranceCode', 'insuranceAccreditationStatus', 'insuranceAccreditationCheckedAt'],
};

function renderInsuranceSection(attributes: FormValues['attributes'] = {}, setFieldValue = vi.fn()) {
  const contextValue = {
    currentPhoto: null,
    identifierTypes: [],
    inEditMode: false,
    initialFormValues: {} as FormValues,
    isOffline: false,
    setCapturePhotoProps: vi.fn(),
    setFieldTouched: vi.fn(),
    setFieldValue,
    validationSchema: null,
    values: { attributes } as FormValues,
  } satisfies PatientRegistrationContextProps;

  render(
    <PatientRegistrationContext.Provider value={contextValue}>
      <InsuranceSection sectionDefinition={insuranceSectionDefinition} />
    </PatientRegistrationContext.Provider>,
  );

  return { setFieldValue };
}

describe('InsuranceSection', () => {
  it('shows only the financer until one is selected', () => {
    renderInsuranceSection();

    expect(screen.getByTestId('field-insuranceType')).toBeInTheDocument();
    expect(screen.queryByTestId('field-sisLookup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceCode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copy responsible data|copiar seguro del responsable/i }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['active', peruInsuranceAccreditationActiveConceptUuid],
    ['inactive', peruInsuranceAccreditationInactiveConceptUuid],
  ])('shows the accreditation date for %s accreditation status', (_label, statusConceptUuid) => {
    renderInsuranceSection({
      [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
      [peruInsuranceAccreditationStatusAttributeTypeUuid]: statusConceptUuid,
    });

    expect(screen.getByTestId('field-sisLookup')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceAccreditationStatus')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceAccreditationCheckedAt')).toBeInTheDocument();
  });

  it('shows only the general insurance code for a non-SIS financer', () => {
    renderInsuranceSection({
      [peruInsuranceTypeAttributeTypeUuid]: 'other-financer-uuid',
    });

    expect(screen.queryByTestId('field-sisLookup')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
  });

  it('migrates the legacy SIS plan value to the canonical SIS financer', async () => {
    const setFieldValue = vi.fn();
    renderInsuranceSection(
      {
        [peruInsuranceTypeAttributeTypeUuid]: peruLegacySisPlanConceptUuid,
      },
      setFieldValue,
    );

    expect(screen.getByTestId('field-sisLookup')).toBeInTheDocument();
    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        `attributes.${peruInsuranceTypeAttributeTypeUuid}`,
        peruInsuranceSisConceptUuid,
        false,
      ),
    );
  });

  it('hides and clears the accreditation date for statuses without accreditation result', async () => {
    const setFieldValue = vi.fn();
    renderInsuranceSection(
      {
        [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
        [peruInsuranceAccreditationStatusAttributeTypeUuid]: noConsultedInsuranceAccreditationConceptUuid,
        [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: '2026-06-17',
      },
      setFieldValue,
    );

    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        `attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`,
        '',
        false,
      ),
    );
  });
});
