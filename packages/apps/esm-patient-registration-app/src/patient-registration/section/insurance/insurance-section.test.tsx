import { render, screen, waitFor } from '@testing-library/react';

import { type SectionDefinition } from '../../../config-schema';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
} from '../../peru-registration-config';
import { InsuranceSection } from './insurance-section.component';

vi.mock('../../field/field.component', () => ({
  Field: ({ name }: { name: string }) => <div data-testid={`field-${name}`}>{name}</div>,
}));

vi.mock('../copy-responsible-data/copy-responsible-data-button.component', () => ({
  CopyResponsibleDataButton: () => <button type="button">Copy responsible data</button>,
}));

const noConsultedInsuranceAccreditationConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2054';

const insuranceSectionDefinition: SectionDefinition = {
  id: 'insurance',
  name: 'Seguro',
  fields: ['insuranceType', 'insuranceCode', 'insuranceAccreditationStatus', 'insuranceAccreditationCheckedAt'],
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
  it('hides the accreditation date when no accreditation result is selected', () => {
    renderInsuranceSection();

    expect(screen.getByTestId('field-insuranceType')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceCode')).toBeInTheDocument();
    expect(screen.getByTestId('field-insuranceAccreditationStatus')).toBeInTheDocument();
    expect(screen.queryByTestId('field-insuranceAccreditationCheckedAt')).not.toBeInTheDocument();
  });

  it.each([
    ['active', peruInsuranceAccreditationActiveConceptUuid],
    ['inactive', peruInsuranceAccreditationInactiveConceptUuid],
  ])('shows the accreditation date for %s accreditation status', (_label, statusConceptUuid) => {
    renderInsuranceSection({
      [peruInsuranceAccreditationStatusAttributeTypeUuid]: statusConceptUuid,
    });

    expect(screen.getByTestId('field-insuranceAccreditationCheckedAt')).toBeInTheDocument();
  });

  it('hides and clears the accreditation date for statuses without accreditation result', async () => {
    const setFieldValue = vi.fn();
    renderInsuranceSection(
      {
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
