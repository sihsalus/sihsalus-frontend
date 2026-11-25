import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';

import type { FuaRequest } from '../hooks/useFuaRequests';
import FuaRequestTable from './fuaRequestTable';

vi.mock('./fua-date-range-picker.component', () => ({
  FuaDateRangePicker: () => null,
}));

const request: FuaRequest = {
  id: 42,
  uuid: 'synthetic-fua',
  visitUuid: 'synthetic-visit',
  name: 'Synthetic request',
  numeroFua: 'TEST-42',
  payload: '{}',
  fechaCreacion: Date.UTC(2026, 0, 1),
  fechaActualizacion: Date.UTC(2026, 0, 1),
};

const emptyMessage = 'No se encontraron solicitudes FUA';
const listRequests = vi.fn<() => Promise<Array<FuaRequest>>>();
const updateStatus = vi.fn<() => Promise<void>>();
const pdfWithSignature = '%PDF-1.4\n% synthetic document\n%%EOF';
let pdfBody: string;

function renderTable() {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        revalidateOnFocus: false,
      }}
    >
      <FuaRequestTable />
    </SWRConfig>,
  );
}

async function downloadFua() {
  renderTable();
  fireEvent.click(await screen.findByRole('button', { name: 'Descargar FUA' }));
}

beforeEach(() => {
  listRequests.mockReset().mockResolvedValue([request]);
  updateStatus.mockReset().mockResolvedValue(undefined);
  pdfBody = pdfWithSignature;

  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (url === '/ws/module/fua/list') {
      return Object.assign(new Response(), { data: await listRequests() });
    }
    if (url === '/ws/module/fua/estado/list/') {
      return Object.assign(new Response(), {
        data: [{ id: 3, uuid: 'synthetic-state', nombre: 'Emitido' }],
      });
    }
    if (url.includes('/visit/synthetic-visit?')) {
      return Object.assign(new Response(), {
        data: { patient: { identifiers: [] } },
      });
    }
    if (url === '/ws/module/fua/generatePDF/synthetic-visit') {
      return Object.assign(
        new Response(pdfBody, {
          headers: { 'Content-Type': 'application/pdf' },
        }),
        { data: null },
      );
    }
    if (url === '/ws/module/fua/estado/update/42') {
      await updateStatus();
      return Object.assign(new Response(), { data: {} });
    }
    throw new Error('Unexpected synthetic test request');
  });

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-fua');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('FUA request table', () => {
  it('distinguishes an unavailable list from an empty list and recovers after retry', async () => {
    listRequests.mockRejectedValueOnce(new Error('synthetic unavailable'));
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las solicitudes FUA');
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('cell', { name: '42' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listRequests).toHaveBeenCalledTimes(2);
  });

  it('keeps cached requests visible and reports a failed refresh', async () => {
    renderTable();
    expect(await screen.findByRole('cell', { name: '42' })).toBeInTheDocument();
    listRequests.mockRejectedValueOnce(new Error('synthetic refresh failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron actualizar las solicitudes FUA');
    expect(screen.getByRole('cell', { name: '42' })).toBeInTheDocument();
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    listRequests.mockResolvedValue([]);
    renderTable();
    expect(await screen.findByText(emptyMessage)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns that an earlier empty list is stale after a refresh failure', async () => {
    listRequests.mockResolvedValueOnce([]);
    renderTable();
    expect(await screen.findByText(emptyMessage)).toBeInTheDocument();
    listRequests.mockRejectedValueOnce(new Error('synthetic refresh failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron actualizar las solicitudes FUA');
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
  });

  it.each([
    ['empty response', ''],
    ['HTML labeled as PDF', '<html><body>Synthetic test message</body></html>'],
  ])('reports an %s without downloading or changing the FUA status', async (_description, body) => {
    pdfBody = body;
    await downloadFua();

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'El archivo recibido no tiene formato PDF. Vuelva a descargar el FUA.',
        }),
      ),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('downloads the returned PDF and updates the request status', async () => {
    await downloadFua();

    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect(openmrsFetch).toHaveBeenCalledWith(
      '/ws/module/fua/estado/update/42',
      expect.objectContaining({
        method: 'PUT',
        body: { estadoId: 3 },
      }),
    );
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-fua');
  });

  it('reports a failed status update without downloading the PDF again', async () => {
    updateStatus.mockRejectedValue(new Error('synthetic update failure'));
    await downloadFua();

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Error al actualizar estado FUA',
        }),
      ),
    );
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledTimes(1);
  });
});
