import { printPdfBytes } from './outpatient-pdf-print';

describe('printPdfBytes', () => {
  const bytes = new Uint8Array([37, 80, 68, 70]);
  const printResourceTimeoutMs = 15_000;
  let afterPrint: (() => void) | undefined;
  let focusTarget: HTMLButtonElement;
  let iframe: HTMLIFrameElement;
  let iframeRemove: ReturnType<typeof vi.spyOn>;
  let printFocusTarget: HTMLButtonElement;
  let printWindow: Pick<Window, 'addEventListener' | 'focus' | 'print'> | null;

  beforeEach(() => {
    afterPrint = undefined;
    focusTarget = document.createElement('button');
    printFocusTarget = document.createElement('button');
    document.body.append(focusTarget, printFocusTarget);
    focusTarget.focus();

    printWindow = {
      addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
        if (event === 'afterprint' && typeof listener === 'function') afterPrint = listener as () => void;
      }),
      focus: vi.fn(() => printFocusTarget.focus()),
      print: vi.fn(),
    };

    const appendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      if (node instanceof HTMLIFrameElement) {
        iframe = node;
        iframeRemove = vi.spyOn(iframe, 'remove');
        Object.defineProperty(iframe, 'contentWindow', {
          configurable: true,
          value: printWindow,
        });
        return node;
      }
      return appendChild(node) as T;
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:patient-instructions');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    focusTarget.remove();
    printFocusTarget.remove();
  });

  it('requests printing, hides the helper iframe and restores focus after printing', async () => {
    vi.useFakeTimers();
    const result = printPdfBytes(bytes, 'indicaciones.pdf');

    expect(iframe.name).toBe('outpatientPatientInstructionsPdfPrinter');
    expect(iframe.tabIndex).toBe(-1);
    expect(iframe).toHaveAttribute('aria-hidden', 'true');
    iframe.onload?.(new Event('load'));

    await expect(result).resolves.toBe('print-requested');
    expect(printWindow?.focus).toHaveBeenCalledOnce();
    expect(printWindow?.print).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(printFocusTarget);

    afterPrint?.();
    expect(iframeRemove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
    await vi.runOnlyPendingTimersAsync();
    expect(document.activeElement).toBe(focusTarget);
  });

  it('downloads the same PDF when the embedded viewer never loads', async () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const result = printPdfBytes(bytes, 'indicaciones.pdf');

    await vi.advanceTimersByTimeAsync(printResourceTimeoutMs);

    await expect(result).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
    expect(iframeRemove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
  });

  it('cancels the pending viewer without printing or downloading after the context is invalidated', async () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const abortController = new AbortController();
    const result = printPdfBytes(bytes, 'indicaciones.pdf', { signal: abortController.signal });
    const queuedLoad = iframe.onload;

    abortController.abort();
    queuedLoad?.call(iframe, new Event('load'));
    await vi.advanceTimersByTimeAsync(printResourceTimeoutMs);

    await expect(result).resolves.toBe('cancelled');
    expect(printWindow?.print).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(iframeRemove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
  });

  it('does not print or download bytes whose clinical precondition expires while the viewer loads', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let isContentCurrent = true;
    const result = printPdfBytes(bytes, 'indicaciones.pdf', {
      isContentCurrent: () => isContentCurrent,
    });
    const queuedLoad = iframe.onload;

    isContentCurrent = false;
    queuedLoad?.call(iframe, new Event('load'));

    await expect(result).resolves.toBe('content-stale');
    expect(printWindow?.print).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(iframeRemove).toHaveBeenCalledOnce();
  });

  it('cleans up an already requested print when its owning context is aborted', async () => {
    const abortController = new AbortController();
    const result = printPdfBytes(bytes, 'indicaciones.pdf', { signal: abortController.signal });
    iframe.onload?.(new Event('load'));
    await expect(result).resolves.toBe('print-requested');

    abortController.abort();

    expect(iframeRemove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
  });

  it('downloads the same PDF when the embedded viewer reports an error', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const result = printPdfBytes(bytes, 'indicaciones.pdf');

    iframe.onerror?.(new Event('error'));

    await expect(result).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
  });

  it('downloads the same PDF when printing throws', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.mocked(printWindow?.print as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('synthetic print failure');
    });
    const result = printPdfBytes(bytes, 'indicaciones.pdf');

    iframe.onload?.(new Event('load'));

    await expect(result).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
  });

  it('releases the local resource on timeout when afterprint is unavailable', async () => {
    vi.useFakeTimers();
    vi.mocked(printWindow?.addEventListener as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('synthetic event failure');
    });
    const result = printPdfBytes(bytes, 'indicaciones.pdf');
    iframe.onload?.(new Event('load'));

    await expect(result).resolves.toBe('print-requested');
    await vi.advanceTimersByTimeAsync(printResourceTimeoutMs);

    expect(iframeRemove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
  });

  it('rejects when the download fallback cannot create its local resource', async () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:patient-instructions')
      .mockImplementationOnce(() => {
        throw new Error('synthetic URL failure');
      });
    const result = printPdfBytes(bytes, 'indicaciones.pdf');

    iframe.onerror?.(new Event('error'));

    await expect(result).rejects.toThrow('synthetic URL failure');
    expect(iframeRemove).toHaveBeenCalledOnce();
  });

  it('rejects immediately when the PDF resource cannot be created', async () => {
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
      throw new Error('synthetic URL failure');
    });

    await expect(printPdfBytes(bytes, 'indicaciones.pdf')).rejects.toThrow('synthetic URL failure');
    expect(document.body.appendChild).not.toHaveBeenCalled();
  });

  it('rejects and revokes the resource when assigning the iframe source fails', async () => {
    vi.useFakeTimers();
    const failingIframe = document.createElement('iframe');
    Object.defineProperty(failingIframe, 'src', {
      configurable: true,
      set: () => {
        throw new Error('synthetic iframe source failure');
      },
    });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) =>
      tagName.toLowerCase() === 'iframe' ? failingIframe : createElement(tagName, options),
    );

    await expect(printPdfBytes(bytes, 'indicaciones.pdf')).rejects.toThrow('synthetic iframe source failure');
    expect(document.body.appendChild).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:patient-instructions');
    await vi.runOnlyPendingTimersAsync();
    expect(document.activeElement).toBe(focusTarget);
  });
});
