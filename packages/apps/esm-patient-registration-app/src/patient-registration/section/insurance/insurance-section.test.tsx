import { render, screen, waitFor } from '@testing-library/react';

import { type SectionDefinition } from '../../../config-schema';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationNotConsultedConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceSelfFinancingConceptUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruLegacySisPlanConceptUuid,
  peruSisEessNameAttributeTypeUuid,
  peruSisTypeDescriptionAttributeTypeUuid,
} from '../../peru-registration-config';
import { InsuranceSection } from './insurance-section.component';

vi.mock('../../field/field.component', () => ({
  Field: ({ name, requiredOverride }: { name: string; requiredOverride?: boolean }) => (
    <div data-required={requiredOverride ? 'true' : 'false'} data-testid={`field-${name}`}>
      {name}
    </div>
  ),
}));

const insuranceSectionDefinition: SectionDefinition = {
  id: 'insurance',
  name: 'Seguro',
  fields: [
    'insuranceType',
    'sisLookup',
    'insuranceCode',
    'insuranceAccreditationStatus',
    'insuranceAccreditationCheckedAt',
  ],
};

function renderInsuranceSection(attributes: FormValues['attributes'] = {}, setFieldValue = vi.fn()) {
  const getContextValue = (nextAttributes: FormValues['attributes']) =>
    ({
      currentPhoto: null,
      identifierTypes: [],
      inEditMode: false,
      initialFormValues: {} as FormValues,
      isOffline: false,
      setCapturePhotoProps: vi.fn(),
      setFieldTouched: vi.fn(),
      setFieldValue,
      validationSchema: null,
      values: { attributes: nextAttributes } as FormValues,
    }) satisfies PatientRegistrationContextProps;

  const { rerender } = render(
    <PatientRegistrationContext.Provider value={getContextValue(attributes)}>
      <InsuranceSection sectionDefinition={insuranceSectionDefinition} />
    </PatientRegistrationContext.Provider>,
  );

  return {
    setFieldValue,
    rerenderWithAttributes: (nextAttributes: FormValues['attributes']) =>
      rerender(
        <PatientRegistrationContext.Provider value={getContextValue(nextAttributes)}>
          <InsuranceSection sectionDefinition={insuranceSectionDefinition} />
        </PatientRegistrationContext.Provider>,
      ),
  };
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
    expect(screen.getByTestId('field-insuranceCode')).toHaveAttribute('data-required', 'true');
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceAccreditationCheckedAt')).toBeInTheDocument();
  });

  it('shows only the general insurance code for a non-SIS financer', () => {
    const setFieldValue = vi.fn();
    renderInsuranceSection(
      {
        [peruInsuranceTypeAttributeTypeUuid]: 'other-financer-uuid',
        [peruInsuranceCodeAttributeTypeUuid]: 'POLIZA-987654',
        [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
        [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: '2026-08-11',
        [peruInsuranceVerificationMethodAttributeTypeUuid]: 'siteds',
      },
      setFieldValue,
    );

    expect(screen.queryByTestId('field-sisLookup')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toHaveAttribute('data-required', 'false');
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('hides and clears SIS data when the financer changes to self-financing', async () => {
    const sisAttributes = {
      [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
      [peruInsuranceCodeAttributeTypeUuid]: 'SIS-12345678',
      [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
      [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: '2026-08-11',
      [peruInsuranceVerificationMethodAttributeTypeUuid]: 'setisis',
      [peruSisTypeDescriptionAttributeTypeUuid]: 'SIS Gratuito',
      [peruSisEessNameAttributeTypeUuid]: 'Hospital Santa Clotilde',
    };
    const { rerenderWithAttributes, setFieldValue } = renderInsuranceSection(sisAttributes);

    expect(screen.getByTestId('field-sisLookup')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toBeInTheDocument();

    rerenderWithAttributes({
      ...sisAttributes,
      [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSelfFinancingConceptUuid,
    });

    expect(screen.queryByTestId('field-sisLookup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceCode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
    await waitFor(() => {
      [
        peruInsuranceCodeAttributeTypeUuid,
        peruInsuranceAccreditationStatusAttributeTypeUuid,
        peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
        peruInsuranceVerificationMethodAttributeTypeUuid,
        peruSisTypeDescriptionAttributeTypeUuid,
        peruSisEessNameAttributeTypeUuid,
      ].forEach((attributeTypeUuid) => {
        expect(setFieldValue).toHaveBeenCalledWith(`attributes.${attributeTypeUuid}`, '', false);
      });
    });
  });

  it('preserves fresh SIS verification data applied together with the financer', () => {
    const existingIaFasAttributes = {
      [peruInsuranceTypeAttributeTypeUuid]: 'essalud-concept-uuid',
      [peruInsuranceCodeAttributeTypeUuid]: 'ESSALUD-123',
      [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
      [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: '2026-08-01',
      [peruInsuranceVerificationMethodAttributeTypeUuid]: 'siteds',
    };
    const { rerenderWithAttributes, setFieldValue } = renderInsuranceSection(existingIaFasAttributes);

    rerenderWithAttributes({
      [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
      [peruInsuranceCodeAttributeTypeUuid]: 'SIS-98765432',
      [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
      [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: '2026-08-11',
      [peruInsuranceVerificationMethodAttributeTypeUuid]: 'setisis',
      [peruSisTypeDescriptionAttributeTypeUuid]: 'SIS Gratuito',
      [peruSisEessNameAttributeTypeUuid]: 'Hospital Santa Clotilde',
    });

    expect(screen.getByTestId('field-sisLookup')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationStatus')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceAccreditationCheckedAt')).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
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
        [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationNotConsultedConceptUuid,
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
