import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndicadorSQLPreview } from '../api/types';
import { useSQLPreview } from '../features/indicadores/hooks';
import SQLPreviewSection from './SQLPreviewSection';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useSQLPreview: vi.fn(),
}));

const mockUseSQLPreview = vi.mocked(useSQLPreview);

function makePreview(overrides: Partial<IndicadorSQLPreview> = {}): IndicadorSQLPreview {
  return {
    sql: 'SELECT 1',
    params: { limit: 100 },
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-01-31',
    version_id: 'v-1',
    version_num: 3,
    ...overrides,
  };
}

describe('SQLPreviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header and a collapsed "Ver" button by default, body hidden', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" />);

    expect(screen.getByText(/SQL generado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver/i })).toBeInTheDocument();
    expect(screen.queryByText(/Período:/i)).not.toBeInTheDocument();
  });

  it('shows the version label when versionNum is provided', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" versionId="v-1" versionNum={3} />);

    expect(screen.getByText(/versión #3/i)).toBeInTheDocument();
  });

  it('omits the version label when versionNum is not provided', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" versionId="v-1" />);

    expect(screen.queryByText(/versión #/i)).not.toBeInTheDocument();
  });

  it('toggles to "Ocultar" and shows InlineLoading while loading when expanded', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Ver/i }));

    expect(screen.getByRole('button', { name: /Ocultar/i })).toBeInTheDocument();
    expect(screen.getByText(/Generando SQL/i)).toBeInTheDocument();
  });

  it('renders the fallback error message when the hook errors', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Ver/i }));

    expect(screen.getByText(/No se pudo generar la vista previa SQL/i)).toBeInTheDocument();
  });

  it('renders the SQL, params and period when data is present and expanded', () => {
    const preview = makePreview({ sql: 'SELECT count(*) FROM atenciones' });
    mockUseSQLPreview.mockReturnValue({
      data: preview,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" versionId="v-1" versionNum={3} />);

    fireEvent.click(screen.getByRole('button', { name: /Ver/i }));

    expect(screen.getByText(/Período: 2026-01-01 - 2026-01-31/i)).toBeInTheDocument();
    expect(screen.getByText('SELECT count(*) FROM atenciones')).toBeInTheDocument();
    // The params <pre> renders pretty-printed JSON; assert on stable substrings
    // (testing-library normalizes whitespace) instead of the exact serialized string.
    expect(screen.getByText((content) => content.includes('"limit"'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('100'))).toBeInTheDocument();
  });

  it('passes indicadorId and versionId to the hook', () => {
    mockUseSQLPreview.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-42" versionId="v-7" versionNum={7} />);

    expect(mockUseSQLPreview).toHaveBeenCalledWith('ind-42', 'v-7');
  });

  it('collapses the body when "Ocultar" is clicked', () => {
    const preview = makePreview();
    mockUseSQLPreview.mockReturnValue({
      data: preview,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SQLPreviewSection indicadorId="ind-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Ver/i }));
    expect(screen.getByText(/Período:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ocultar/i }));
    expect(screen.queryByText(/Período:/i)).not.toBeInTheDocument();
  });
});
