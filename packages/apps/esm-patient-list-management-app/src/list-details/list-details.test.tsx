import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { deletePatientList } from '../api/api-remote';
import { usePatientListDetails, usePatientListMembers } from '../api/hooks';
import type { OpenmrsCohort, OpenmrsCohortMember } from '../api/types';

import ListDetails from './list-details.component';

const mockUsePatientListDetails = vi.mocked(usePatientListDetails);
const mockUsePatientListMembers = vi.mocked(usePatientListMembers);
const mockDeletePatientList = vi.mocked(deletePatientList);

vi.mock('../api/hooks', () => ({
  usePatientListDetails: vi.fn(),
  usePatientListMembers: vi.fn(),
}));

vi.mock('../api/api-remote');

const mockPatientListDetails = {
  name: 'Test Patient List',
  description: 'This is a test patient list',
  size: 1,
  startDate: '2023-08-14',
} as OpenmrsCohort;

const mockPatientListMembers = [
  {
    name: 'MINDSCAPE Cohort',
    description:
      'Mental Illness and Neuroimaging Study for Personalized Assessment and Care Evaluation (develops personalized treatment plans for mental illness based on brain imaging and individual factors)',
    patient: {
      person: {
        display: 'John Doe',
        gender: 'Male',
      },
      identifiers: [
        {
          identifier: '100GEJ',
        },
      ],
      uuid: '7cd38a6d-377e-491b-8284-b04cf8b8c6d8',
    },
    attributes: [],
    endDate: null,
    startDate: '2023-08-10',
    uuid: 'ce7d26fa-e1b4-4e78-a1f5-3a7a5de9c0db',
    voided: false,
  },
] as OpenmrsCohortMember[];

describe('ListDetails', () => {
  beforeEach(() => {
    mockUsePatientListDetails.mockReturnValue({
      listDetails: mockPatientListDetails,
      error: null,
      isLoading: false,
      mutateListDetails: vi.fn().mockResolvedValue({}),
    });

    mockUsePatientListMembers.mockReturnValue({
      listMembers: mockPatientListMembers,
      isLoadingListMembers: false,
      error: null,
      mutateListMembers: vi.fn().mockResolvedValue({}),
    });

    mockDeletePatientList.mockResolvedValue({});
  });

  it('renders patient list details page', async () => {
    render(<ListDetails />);

    expect(screen.getByRole('heading', { name: /^test patient list$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /this is a test patient list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to lists page/i })).toBeInTheDocument();
    expect(screen.getByText(/1 patient/)).toBeInTheDocument();
    expect(screen.getByText(/Created on/i)).toBeInTheDocument();
    expect(screen.getByText(/14-Aug-2023/)).toBeInTheDocument();
    expect(screen.getByText(/edit name or description/i)).toBeInTheDocument();
    expect(screen.getByText(/delete patient list/i)).toBeInTheDocument();
  });

  it('renders an empty state view if a list has no patients', async () => {
    mockUsePatientListMembers.mockReturnValue({
      listMembers: [],
      isLoadingListMembers: false,
      error: null,
      mutateListMembers: vi.fn().mockResolvedValue({}),
    });

    render(<ListDetails />);

    expect(screen.getByTitle(/empty state illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/there are no patients in this list/i)).toBeInTheDocument();
  });

  it('opens overlay with a form when the "Edit name or description" button is clicked', async () => {
    render(<ListDetails />);

    await userEvent.click(screen.getByText('Actions'));
    const editBtn = screen.getByText('Edit name or description');
    await userEvent.click(editBtn);
  });

  it('deletes patient list and navigates back to the list page', async () => {
    render(<ListDetails />);

    await userEvent.click(screen.getByText('Actions'));
    await userEvent.click(screen.getByText(/delete patient list/i));

    expect(screen.getByText(/Are you sure you want to delete this patient list/i)).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    expect(screen.getByText('Delete').closest('button')).toBeEnabled();

    await userEvent.click(screen.getByText('Cancel'));
  });
});
