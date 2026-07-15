import { logError } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ResourcesContext, type Resources } from '../offline.resources';
import type { ParsedPatientImportRow } from './bulk-patient-import.types';
import {
  createPatientFromImportRow,
  parseSantaClotildeWorkbook,
} from './bulk-patient-import.utils';
import BulkPatientImport from './bulk-patient-import.component';

vi.mock('./bulk-patient-import.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bulk-patient-import.utils')>();
  return {
    ...actual,
    createPatientFromImportRow: vi.fn(),
    downloadImportReport: vi.fn(),
    downloadSantaClotildeTemplate: vi.fn(),
    parseSantaClotildeWorkbook: vi.fn(),
  };
});

const mockCreatePatientFromImportRow = vi.mocked(createPatientFromImportRow);
const mockLogError = vi.mocked(logError);
const mockParseSantaClotildeWorkbook = vi.mocked(parseSantaClotildeWorkbook);

const validRow: ParsedPatientImportRow = {
  id: 'row-2',
  rowNumber: 2,
  raw: {
    ORDEN: '1',
    DNI: '12345678',
    SEXO: 'F',
    'F.N.': '01/01/1990',
    'A.PATERNO': 'PEREZ',
    'A.MATERNO': 'FLORES',
    NOMBRES: 'ROSA',
    PARENTESCO: '',
    DOMICILIO: 'IQUITOS',
  },
  normalized: {
    orden: '1',
    dni: '12345678',
    gender: 'F',
    birthdate: '1990-01-01',
    familyName: 'PEREZ',
    familyName2: 'FLORES',
    givenName: 'ROSA',
    middleName: '',
    parentesco: '',
    domicilio: 'IQUITOS',
  },
  errors: [],
  warnings: [],
  status: 'valid',
};

const resources = {
  currentSession: { sessionLocation: { uuid: 'location-uuid' } },
  identifierTypes: [{ uuid: 'dni-type-uuid' }],
  isLoadingIdentifierTypes: false,
} as Resources;

describe('BulkPatientImport', () => {
  beforeEach(() => {
    mockCreatePatientFromImportRow.mockReset();
    mockLogError.mockClear();
    mockParseSantaClotildeWorkbook.mockReset();
  });

  it('logs spreadsheet parsing details and shows only a fixed localized fallback', async () => {
    const error = new Error('Missing internal worksheet XML');
    mockParseSantaClotildeWorkbook.mockRejectedValue(error);

    const { container } = renderBulkPatientImport();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['bad'], 'patients.xlsx')] } });

    expect(await screen.findByText('Try refreshing the page or contact your system administrator')).toBeInTheDocument();
    expect(screen.queryByText('Missing internal worksheet XML')).not.toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(error, 'Bulk patient import file parsing failed');
  });

  it('logs row creation failures and stores only the fixed patient-save fallback', async () => {
    const error = new Error('DNI database connection failed');
    mockParseSantaClotildeWorkbook.mockResolvedValue([{ ...validRow }]);
    mockCreatePatientFromImportRow.mockRejectedValue(error);

    const { container } = renderBulkPatientImport();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['valid'], 'patients.xlsx')] } });

    await screen.findByRole('button', { name: /crear pacientes|create patients/i });
    fireEvent.click(screen.getByRole('button', { name: /crear pacientes|create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /crear pacientes|create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);

    await waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith(error, 'Bulk patient import failed for row 2');
    });
    expect(
      screen.getByText(
        'No se pudo confirmar la creación de esta fila. Busque al paciente por documento antes de reintentar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('DNI database connection failed')).not.toBeInTheDocument();
  });
});

function renderBulkPatientImport() {
  return render(
    <ResourcesContext.Provider value={resources}>
      <BulkPatientImport isOffline={false} />
    </ResourcesContext.Provider>,
  );
}
