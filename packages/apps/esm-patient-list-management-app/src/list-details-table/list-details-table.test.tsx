import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { removePatientFromList } from '../api/api-remote';

import ListDetailsTable from './list-details-table.component';

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockRemovePatientFromList = vi.mocked(removePatientFromList);
const mockShowSnackbar = vi.mocked(showSnackbar);

vi.mock('../api/api-remote');

describe('ListDetailsTable', () => {
  const patients = [
    {
      identifier: '123abced',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      sex: 'Male',
      startDate: '2023-08-10',
      membershipUuid: 'de8e37fb-f2c5-4f89-b2b5-c15df9c7d1ec',
    },
    {
      identifier: '123abcedfg',
      name: 'Jane Smith',
      firstName: 'Jane',
      lastName: 'Smith',
      age: 25,
      sex: 'Female',
      startDate: '2023-08-10',
      membershipUuid: 'ce7d26fa-e1b4-4e78-a1f5-3a7a5de9c0db',
    },
  ];

  const columns = [
    {
      key: 'firstName',
      header: 'First Name',
    },
    {
      key: 'lastName',
      header: 'Last Name',
      link: {
        getUrl: (patient) => `/patient/${patient.id}`,
      },
    },
    {
      key: 'age',
      header: 'Age',
      getValue: (patient) => `${patient.age} years`,
    },
  ];

  const mockOnChange = vi.fn();

  const pagination = {
    usePagination: true,
    currentPage: 1,
    onChange: mockOnChange,
    pageSize: 10,
    totalItems: 100,
    pagesUnknown: false,
  };

  it('renders table with patient data', () => {
    render(
      <ListDetailsTable
        canEdit
        patients={patients}
        columns={columns}
        pagination={pagination}
        isLoading={false}
        autoFocus={false}
        isFetching={true}
        mutateListDetails={vi.fn()}
        mutateListMembers={vi.fn()}
      />,
    );
    expect(screen.getByTestId('patientsTable')).toBeInTheDocument();
  });

  it('does not expose membership mutations in read-only mode', () => {
    render(
      <ListDetailsTable
        patients={patients}
        columns={columns}
        pagination={pagination}
        isLoading={false}
        isFetching={false}
        mutateListDetails={vi.fn()}
        mutateListMembers={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /remove from list/i })).not.toBeInTheDocument();
  });

  it('does not expose backend details when removing a patient fails', async () => {
    const backendError = new Error('org.hibernate.exception.ConstraintViolationException');
    mockRemovePatientFromList.mockRejectedValueOnce(backendError);

    render(
      <ListDetailsTable
        canEdit
        patients={patients}
        columns={columns}
        pagination={pagination}
        isLoading={false}
        isFetching={false}
        mutateListDetails={vi.fn()}
        mutateListMembers={vi.fn()}
      />,
    );

    await userEvent.click(screen.getAllByRole('button', { name: /remove from list/i })[0]);
    const confirmationDialog = screen.getByRole('dialog');
    await userEvent.click(within(confirmationDialog).getByRole('button', { name: /remove from list/i }));

    await waitFor(() =>
      expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
        backendError,
        'The patient could not be removed from the list. Please try again.',
        { logContext: 'Remove patient from list' },
      ),
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'The patient could not be removed from the list. Please try again.' }),
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ subtitle: backendError.message }));
  });

  it('renders loading skeleton when loading', () => {
    render(
      <ListDetailsTable
        patients={patients}
        columns={columns}
        pagination={pagination}
        isLoading={true}
        autoFocus={false}
        isFetching={false}
        mutateListDetails={vi.fn()}
        mutateListMembers={vi.fn()}
      />,
    );

    expect(screen.getByTestId('data-table-skeleton')).toBeInTheDocument();
  });
});
