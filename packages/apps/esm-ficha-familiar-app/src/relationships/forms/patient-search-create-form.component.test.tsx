import { showModal } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { relationshipFormSchema } from '../relationship.resources';
import PatientSearchCreate from './patient-search-create-form.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showModal: vi.fn(),
  useConfig: () => ({
    concepts: { maritalStatusConceptUuid: '11111111-1111-4111-8111-111111111111' },
    contactListConceptMap: {},
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('../../autosuggest/autosuggest.component', () => ({
  Autosuggest: () => <div>Person search</div>,
}));

vi.mock('../../autosuggest/patient-search-info.component', () => ({
  default: () => null,
}));

vi.mock('../../autosuggest/search-empty-state.component', () => ({
  default: () => null,
}));

const selectedPersonUuid = '22222222-2222-4222-8222-222222222222';
const mockShowModal = vi.mocked(showModal);

function FormHarness({ mode, personB }: { mode: 'create' | 'search'; personB?: string }) {
  const form = useForm<z.infer<typeof relationshipFormSchema>>({
    defaultValues: {
      mode,
      personA: '11111111-1111-4111-8111-111111111111',
      personB,
      relationshipType: '33333333-3333-4333-8333-333333333333',
      personBInfo: {
        givenName: 'Persona',
        familyName: 'Prueba',
        familyName2: 'Segura',
        gender: 'F',
        birthdate: new Date('1990-01-01'),
      },
    },
  });

  return (
    <FormProvider {...form}>
      <PatientSearchCreate />
      <output data-testid="person-b">{form.watch('personB') ?? ''}</output>
      <output data-testid="birthdate-estimated">{String(form.watch('personBInfo.birthdateEstimated') ?? false)}</output>
    </FormProvider>
  );
}

describe('PatientSearchCreate', () => {
  beforeEach(() => {
    mockShowModal.mockReset();
  });

  it('clears a searched Person before switching to relative creation', async () => {
    render(<FormHarness mode="search" personB={selectedPersonUuid} />);

    expect(screen.getByTestId('person-b')).toHaveTextContent(selectedPersonUuid);
    fireEvent.click(screen.getByText('Create relative'));

    await waitFor(() => expect(screen.getByTestId('person-b')).toBeEmptyDOMElement());
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
  });

  it('shows a retry state and hides already-persisted demographics', () => {
    render(<FormHarness mode="create" personB={selectedPersonUuid} />);

    expect(screen.getByText('Person already created')).toBeInTheDocument();
    expect(screen.getByText(/Only the relationship is pending/)).toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('marks a birthdate calculated from age as estimated', async () => {
    render(<FormHarness mode="create" />);

    fireEvent.click(screen.getByText('From Age'));
    const modalOptions = mockShowModal.mock.calls[0][1] as {
      props: { onBirthDateChange: (date: Date) => void };
    };
    act(() => modalOptions.props.onBirthDateChange(new Date('1990-01-01')));

    await waitFor(() => expect(screen.getByTestId('birthdate-estimated')).toHaveTextContent('true'));
  });
});
