import { act, renderHook } from '@testing-library/react';

import { useConceptSearchInput } from './useConceptSearchInput';

// Mock the useDebounce hook
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useDebounce: vi.fn((value) => value),
}));

describe('useConceptSearchInput', () => {
  const mockOnConceptSelect = vi.fn();
  const defaultProps = {
    parameterName: 'testParameter',
    onConceptSelect: mockOnConceptSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty values', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedConcept).toBeNull();
    expect(result.current.debouncedSearchTerm).toBe('');
  });

  it('should update search term when handleSearchTermChange is called', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    act(() => {
      result.current.handleSearchTermChange({
        target: { value: 'test search' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.searchTerm).toBe('test search');
  });

  it('should clear selected concept when typing after selection', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    // First select a concept
    act(() => {
      result.current.handleConceptSelect({
        uuid: 'concept-uuid',
        display: 'Test Concept',
      });
    });

    expect(result.current.selectedConcept).not.toBeNull();

    // Then start typing
    act(() => {
      result.current.handleSearchTermChange({
        target: { value: 'new search' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.selectedConcept).toBeNull();
  });

  it('should handle concept selection correctly', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    const mockConcept = {
      uuid: 'concept-uuid-123',
      display: 'Test Concept Name',
    };

    act(() => {
      result.current.handleConceptSelect(mockConcept);
    });

    expect(result.current.selectedConcept).toEqual(mockConcept);
    expect(result.current.searchTerm).toBe('Test Concept Name');
    expect(mockOnConceptSelect).toHaveBeenCalledWith('concept-uuid-123', 'Test Concept Name');
  });

  it('should reset search state when resetSearch is called', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    // Set some state first
    act(() => {
      result.current.handleConceptSelect({
        uuid: 'concept-uuid',
        display: 'Test Concept',
      });
    });

    expect(result.current.searchTerm).toBe('Test Concept');
    expect(result.current.selectedConcept).not.toBeNull();

    // Reset
    act(() => {
      result.current.resetSearch();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedConcept).toBeNull();
  });

  it('should handle concept selection without display name', () => {
    const { result } = renderHook(() => useConceptSearchInput(defaultProps));

    const mockConcept = {
      uuid: 'concept-uuid-123',
    };

    act(() => {
      result.current.handleConceptSelect(mockConcept);
    });

    expect(result.current.selectedConcept).toEqual(mockConcept);
    expect(result.current.searchTerm).toBe('');
    expect(mockOnConceptSelect).toHaveBeenCalledWith('concept-uuid-123', '');
  });
});
