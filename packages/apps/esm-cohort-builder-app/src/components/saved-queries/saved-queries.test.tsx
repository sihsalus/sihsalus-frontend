import { openmrsFetch } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { type DefinitionDataRow } from '../../types';
import SavedQueries from './saved-queries.component';
import { getQueries } from './saved-queries.resources';

const mockGetQueries = vi.mocked(getQueries);
const mockOpenmrsFetch = openmrsFetch as vi.Mock;

const mockQueries: DefinitionDataRow[] = [
  {
    id: '1',
    name: 'male alive',
    description: 'male patients that are alive',
  },
  {
    id: '2',
    name: 'Female ages between 10 and 30',
    description: 'male patients with ages between 10 and 30 years that are alive',
  },
];

vi.mock('./saved-queries.resources', async () => {
  const original = await vi.importActual('./saved-queries.resources');
  return {
    ...original,
    getQueries: vi.fn(),
  };
});

describe('Test the saved queries component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be able to search for a query', async () => {
    mockOpenmrsFetch.mockReturnValue({
      data: { results: mockQueries },
    });
    mockGetQueries.mockResolvedValue(mockQueries);

    render(<SavedQueries onViewQuery={vi.fn()} />);

    // Wait for the table to be present
    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();

    // Wait for the data to be loaded and verify each query
    for (const query of mockQueries) {
      const nameCell = await screen.findByText(query.name);
      expect(nameCell).toBeInTheDocument();
      expect(screen.getByText(query.description)).toBeInTheDocument();
    }
  });
});
