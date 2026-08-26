import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { Formik } from 'formik';

import { type RegistrationConfig } from '../../config-schema';
import { SectionWrapper } from './section-wrapper.component';

vi.mock('./section.component', () => ({
  Section: () => <div>Section content</div>,
}));

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const responsibleRelationshipType = 'guardian-relationship/aIsToB';
const sectionDefinition = {
  id: 'responsiblePerson',
  name: 'Companion or responsible person',
  fields: [],
};

describe('SectionWrapper', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      relationshipOptions: {
        minorResponsibleRelationshipTypes: [responsibleRelationshipType],
      },
    } as RegistrationConfig);
  });

  it('does not report the missing responsible person before form submission', () => {
    render(
      <Formik
        initialValues={{ birthdate: dayjs().subtract(10, 'years').toDate(), relationships: [] }}
        onSubmit={vi.fn()}
      >
        <SectionWrapper index={2} sectionDefinition={sectionDefinition} />
      </Formik>,
    );

    const section = screen.getByText('Section content').closest('#responsiblePerson');
    expect(section).toBeInTheDocument();
    expect(section).not.toHaveAttribute('aria-invalid');
    expect(section).not.toHaveAttribute('data-requires-attention');
  });

  it('marks the responsible person section invalid after its validation error is touched', () => {
    render(
      <Formik
        initialErrors={{ relationships: 'responsibleRelationshipRequiredForMinor' }}
        initialTouched={{ relationships: true }}
        initialValues={{ birthdate: dayjs().subtract(10, 'years').toDate(), relationships: [] }}
        onSubmit={vi.fn()}
      >
        <SectionWrapper index={2} sectionDefinition={sectionDefinition} />
      </Formik>,
    );

    expect(screen.getByText('Section content').closest('[aria-invalid="true"]')).toBeInTheDocument();
  });

  it('does not highlight the section when an adult responsible person is registered', () => {
    render(
      <Formik
        initialValues={{
          birthdate: dayjs().subtract(10, 'years').toDate(),
          relationships: [
            {
              action: 'ADD',
              isCompanion: true,
              relatedPersonAge: 30,
              relatedPersonUuid: 'responsible-person-uuid',
              relationshipType: responsibleRelationshipType,
            },
          ],
        }}
        onSubmit={vi.fn()}
      >
        <SectionWrapper index={2} sectionDefinition={sectionDefinition} />
      </Formik>,
    );

    const section = screen.getByText('Section content').closest('[data-requires-attention]');
    expect(section).not.toBeInTheDocument();
  });
});
