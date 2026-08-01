import { render, screen } from '@testing-library/react';

import ListDetailsTable from './list-details-table.component';

describe('ListDetailsTable', () => {
  const patients = [
    {
      identifier: '123abced',
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      sex: 'Male',
      startDate: '2023-08-10',
      membershipUuid: 'de8e37fb-f2c5-4f89-b2b5-c15df9c7d1ec',
    },
    {
      identifier: '123abcedfg',
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
