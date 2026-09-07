import {
  createAttachment,
  showModal,
  useConfig,
  useConnectivity,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import type { Order } from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentsConfigSchema, type AttachmentsConfig } from '../attachments-config-schema';
import LabOrderPdf from './lab-order-pdf.component';
import { getLabOrderPdfAttachments } from './lab-order-pdf.resource';

vi.mock('./lab-order-pdf.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lab-order-pdf.resource')>()),
  getLabOrderPdfAttachments: vi.fn(),
}));

const orderUuid = '11111111-1111-1111-1111-111111111111';
const encounterUuid = '22222222-2222-2222-2222-222222222222';
const patientUuid = '33333333-3333-3333-3333-333333333333';

const inProgressOrder = {
  encounter: { uuid: encounterUuid },
  fulfillerStatus: 'IN_PROGRESS',
  orderNumber: 'ORD-1',
  patient: { uuid: patientUuid },
  type: 'testorder',
  uuid: orderUuid,
} as Order;

const mockCreateAttachment = vi.mocked(createAttachment);
const mockGetLabOrderPdfAttachments = vi.mocked(getLabOrderPdfAttachments);
const mockShowModal = vi.mocked(showModal);
const mockUseConfig = vi.mocked(useConfig<AttachmentsConfig>);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

describe('LabOrderPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({ enableLabOrderPdfAttachments: true, maxFileSize: 1 });
    mockUseConnectivity.mockReturnValue(true);
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: '99999999-9999-9999-9999-999999999999' },
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
    mockGetLabOrderPdfAttachments.mockResolvedValue([]);
    mockCreateAttachment.mockResolvedValue({} as Awaited<ReturnType<typeof createAttachment>>);
    mockShowModal.mockReturnValue(vi.fn());
  });

  it('remains inactive by default without reading order attachments', () => {
    expect(attachmentsConfigSchema.enableLabOrderPdfAttachments._default).toBe(false);
    mockUseConfig.mockReturnValue({
      enableLabOrderPdfAttachments: attachmentsConfigSchema.enableLabOrderPdfAttachments._default,
      maxFileSize: 1,
    });

    render(<LabOrderPdf order={inProgressOrder} />);

    expect(screen.queryByText('Supplemental laboratory PDFs')).not.toBeInTheDocument();
    expect(mockGetLabOrderPdfAttachments).not.toHaveBeenCalled();
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  it('does not read or render when View Attachments is missing', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'View Attachments');

    render(<LabOrderPdf order={inProgressOrder} />);

    expect(screen.queryByText('Supplemental laboratory PDFs')).not.toBeInTheDocument();
    expect(mockGetLabOrderPdfAttachments).not.toHaveBeenCalled();
  });

  it('offers one PDF up to 5 MiB only for a verified in-progress order', async () => {
    render(<LabOrderPdf order={inProgressOrder} />);

    const addButton = await screen.findByRole('button', { name: 'Attach laboratory PDF' });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockShowModal).toHaveBeenCalledWith(
      'capture-photo-modal',
      expect.objectContaining({
        allowedExtensions: ['pdf'],
        initialView: 'upload',
        maxFileSizeMb: 5,
        multipleFiles: false,
        skipConfiguredAllowlistLookup: true,
      }),
    );

    const modalOptions = mockShowModal.mock.calls[0][1] as {
      saveFile: (file: {
        base64Content: string;
        file: File;
        fileDescription: string;
        fileName: string;
        fileType: string;
      }) => Promise<unknown>;
    };
    await modalOptions.saveFile({
      base64Content: 'data:application/pdf;base64,aGVsbG8=',
      file: new File(['hello'], 'result.pdf', { type: 'application/pdf' }),
      fileDescription: '',
      fileName: 'result.pdf',
      fileType: 'pdf',
    });

    expect(mockCreateAttachment).toHaveBeenCalledWith(
      patientUuid,
      expect.objectContaining({ fileName: `resultado-laboratorio-${orderUuid}.pdf` }),
      expect.any(AbortSignal),
      {
        encounterUuid,
        formFieldNamespace: 'sihsalus-laboratory',
        formFieldPath: `sihsalus-laboratory-order-${orderUuid}-supplemental-pdf`,
      },
    );
  });

  it('serializes upload attempts while one PDF is in flight', async () => {
    let resolveUpload!: (value: Awaited<ReturnType<typeof createAttachment>>) => void;
    mockCreateAttachment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const disposeModal = vi.fn();
    mockShowModal.mockReturnValue(disposeModal);
    render(<LabOrderPdf order={inProgressOrder} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attach laboratory PDF' }));
    const modalOptions = mockShowModal.mock.calls[0][1] as {
      closeModal: () => void;
      saveFile: (file: {
        base64Content: string;
        file: File;
        fileDescription: string;
        fileName: string;
        fileType: string;
      }) => Promise<unknown>;
    };
    const file = {
      base64Content: 'data:application/pdf;base64,aGVsbG8=',
      file: new File(['hello'], 'result.pdf', { type: 'application/pdf' }),
      fileDescription: '',
      fileName: 'result.pdf',
      fileType: 'pdf',
    };

    const firstUpload = modalOptions.saveFile(file);
    modalOptions.closeModal();
    expect(disposeModal).not.toHaveBeenCalled();
    await expect(modalOptions.saveFile(file)).rejects.toThrow('already in progress');
    expect(mockCreateAttachment).toHaveBeenCalledTimes(1);
    resolveUpload({} as Awaited<ReturnType<typeof createAttachment>>);
    await firstUpload;
    modalOptions.closeModal();
    expect(disposeModal).toHaveBeenCalledTimes(1);
  });

  it('keeps upload hidden outside IN_PROGRESS while preserving read access', async () => {
    render(<LabOrderPdf order={{ ...inProgressOrder, fulfillerStatus: 'COMPLETED' }} />);

    expect(await screen.findByText('No supplemental PDF is attached to this order.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Attach laboratory PDF' })).not.toBeInTheDocument();
    expect(mockGetLabOrderPdfAttachments).toHaveBeenCalledTimes(1);
  });

  it('rejects the upload if an open modal observes that the order is no longer in progress', async () => {
    const { rerender } = render(<LabOrderPdf order={inProgressOrder} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attach laboratory PDF' }));
    const modalOptions = mockShowModal.mock.calls[0][1] as {
      saveFile: (file: {
        base64Content: string;
        file: File;
        fileDescription: string;
        fileName: string;
        fileType: string;
      }) => Promise<unknown>;
    };

    await act(async () => {
      rerender(<LabOrderPdf order={{ ...inProgressOrder, fulfillerStatus: 'COMPLETED' }} />);
    });

    await expect(
      modalOptions.saveFile({
        base64Content: 'data:application/pdf;base64,aGVsbG8=',
        file: new File(['hello'], 'result.pdf', { type: 'application/pdf' }),
        fileDescription: '',
        fileName: 'result.pdf',
        fileType: 'pdf',
      }),
    ).rejects.toThrow('The laboratory order is no longer in progress.');
    expect(mockCreateAttachment).not.toHaveBeenCalled();
  });

  it('keeps upload hidden offline', async () => {
    mockUseConnectivity.mockReturnValue(false);

    render(<LabOrderPdf order={inProgressOrder} />);

    expect(await screen.findByText('PDF upload unavailable offline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Attach laboratory PDF' })).not.toBeInTheDocument();
  });

  it('rejects a PDF larger than 5 MiB before the upload request', async () => {
    render(<LabOrderPdf order={inProgressOrder} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attach laboratory PDF' }));
    const modalOptions = mockShowModal.mock.calls[0][1] as {
      saveFile: (file: {
        base64Content: string;
        file: File;
        fileDescription: string;
        fileName: string;
        fileType: string;
      }) => Promise<unknown>;
    };

    await expect(
      modalOptions.saveFile({
        base64Content: 'data:application/pdf;base64,',
        file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }),
        fileDescription: '',
        fileName: 'large.pdf',
        fileType: 'pdf',
      }),
    ).rejects.toThrow('Only a valid PDF file can be attached.');
    expect(mockCreateAttachment).not.toHaveBeenCalled();
  });

  it('replaces backend upload details with a fixed user-facing error', async () => {
    mockCreateAttachment.mockRejectedValue(new Error('sensitive backend details'));
    render(<LabOrderPdf order={inProgressOrder} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attach laboratory PDF' }));
    const modalOptions = mockShowModal.mock.calls[0][1] as {
      saveFile: (file: {
        base64Content: string;
        file: File;
        fileDescription: string;
        fileName: string;
        fileType: string;
      }) => Promise<unknown>;
    };

    await expect(
      modalOptions.saveFile({
        base64Content: 'data:application/pdf;base64,aGVsbG8=',
        file: new File(['hello'], 'result.pdf', { type: 'application/pdf' }),
        fileDescription: '',
        fileName: 'result.pdf',
        fileType: 'pdf',
      }),
    ).rejects.toThrow('The PDF could not be attached. Try again.');
  });

  it('renders only a sandboxed read-only preview for a matched PDF', async () => {
    window.openmrsBase = 'about:blank#';
    mockGetLabOrderPdfAttachments.mockResolvedValue([
      {
        bytesContentFamily: 'PDF',
        bytesMimeType: 'application/pdf',
        comment: '',
        dateTime: '2026-08-26T10:00:00.000-05:00',
        filename: 'matched.pdf',
        uuid: '44444444-4444-4444-4444-444444444444',
      },
    ]);

    render(<LabOrderPdf order={{ ...inProgressOrder, fulfillerStatus: 'COMPLETED' }} />);
    const documentButton = await screen.findByRole('button', { name: /Laboratory PDF —/ });
    expect(screen.queryByText('matched.pdf')).not.toBeInTheDocument();
    fireEvent.click(documentButton);

    const preview = screen.getByTitle('Laboratory PDF preview');
    expect(preview).toHaveAttribute('sandbox', '');
    expect(preview).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.queryByRole('button', { name: /delete|remove|replace/i })).not.toBeInTheDocument();
  });
});
