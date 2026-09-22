import { act, renderHook, waitFor } from '@testing-library/react';
import { useStickerPdfPrinter } from './useStickerPdfPrinter';

describe('useStickerPdfPrinter', () => {
  let mockContentWindow: any;
  let afterPrintHandler: (() => void) | null = null;

  beforeEach(() => {
    afterPrintHandler = null;

    // Create a mock contentWindow with all required methods
    mockContentWindow = {
      print: vi.fn(),
      focus: vi.fn(),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'afterprint') {
          afterPrintHandler = handler;
        }
      }),
    };

    // Mock HTMLIFrameElement.prototype.contentWindow to return our mock
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get: () => mockContentWindow,
    });

    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      set: function (value) {
        this._src = value;
        // Trigger onload asynchronously to simulate real behavior
        if (this.onload) {
          Promise.resolve().then(() => {
            if (this.onload) {
              this.onload({} as Event);
            }
          });
        }
      },
      get: function () {
        return this._src;
      },
    });

    // Mock document.hasFocus to support the polling mechanism
    document.hasFocus = vi.fn().mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    afterPrintHandler = null;
  });

  const waitForIframeLoad = () => {
    // Wait for next tick to allow iframe onload to trigger
    return new Promise((resolve) => setTimeout(resolve, 0));
  };

  const triggerPrintCompletion = () => {
    // Simulate the print dialog closing by triggering afterprint event
    if (afterPrintHandler) {
      afterPrintHandler();
    }
  };

  it('should provide printPdf function and isPrinting state', () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    expect(result.current.isPrinting).toBe(false);
    expect(typeof result.current.printPdf).toBe('function');
  });

  it('should set isPrinting to true when printing starts', () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      result.current.printPdf('about:blank#synthetic-test.pdf');
    });

    expect(result.current.isPrinting).toBe(true);
  });

  it('should reject concurrent print requests with an error', async () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      result.current.printPdf('about:blank#synthetic-test.pdf');
    });

    await expect(result.current.printPdf('about:blank#synthetic-test2.pdf')).rejects.toThrow(
      'Print already in progress',
    );
  });

  it('should reset isPrinting to false when printing completes', async () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      result.current.printPdf('about:blank#synthetic-test.pdf');
    });

    expect(result.current.isPrinting).toBe(true);

    // Wait for iframe to load
    await act(async () => {
      await waitForIframeLoad();
    });

    // Simulate print completion
    act(() => {
      triggerPrintCompletion();
    });

    await waitFor(() => {
      expect(result.current.isPrinting).toBe(false);
    });
  });

  it('should return a promise that resolves when printing completes', async () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    let resolved = false;
    let printPromise: Promise<void>;

    act(() => {
      printPromise = result.current.printPdf('about:blank#synthetic-test.pdf').then(() => {
        resolved = true;
      });
    });

    expect(resolved).toBe(false);

    // Wait for iframe to load
    await act(async () => {
      await waitForIframeLoad();
    });

    // Simulate print completion
    act(() => {
      triggerPrintCompletion();
    });

    await waitFor(() => {
      expect(resolved).toBe(true);
    });

    await printPromise;
  });

  it('should allow printing again after previous print completes', async () => {
    const { result } = renderHook(() => useStickerPdfPrinter());

    // First print
    act(() => {
      result.current.printPdf('about:blank#synthetic-test1.pdf');
    });

    await act(async () => {
      await waitForIframeLoad();
    });

    act(() => {
      triggerPrintCompletion();
    });

    await waitFor(() => {
      expect(result.current.isPrinting).toBe(false);
    });

    // Second print should succeed
    act(() => {
      result.current.printPdf('about:blank#synthetic-test2.pdf');
    });

    expect(result.current.isPrinting).toBe(true);

    await act(async () => {
      await waitForIframeLoad();
    });

    act(() => {
      triggerPrintCompletion();
    });

    await waitFor(() => {
      expect(result.current.isPrinting).toBe(false);
    });
  });

  it('should reset isPrinting after timeout when print cannot be detected as complete', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      result.current.printPdf('about:blank#synthetic-test.pdf');
    });

    expect(result.current.isPrinting).toBe(true);

    // Fast-forward time to trigger iframe load, then advance past timeout
    // The iframe onload will be triggered via Promise.resolve() which needs runAllTimers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Verify timeout mechanism resets isPrinting (afterprint never fired)
    expect(result.current.isPrinting).toBe(false);
  });

  it('rejects a missing print window and resets isPrinting so the caller can offer retry', async () => {
    // Mock contentWindow to return null to simulate an error
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get: () => null,
    });

    const { result } = renderHook(() => useStickerPdfPrinter());

    await act(async () => {
      await expect(result.current.printPdf('about:blank#synthetic-pdf')).rejects.toThrow('could not be printed');
    });

    await waitFor(() => {
      expect(result.current.isPrinting).toBe(false);
    });

    expect(document.querySelector('iframe[name="pdfPrinterFrame"]')).not.toBeInTheDocument();
  });

  it('should complete printing using polling fallback when afterprint listener fails', async () => {
    vi.useFakeTimers();

    mockContentWindow.addEventListener.mockImplementationOnce(() => {
      throw new Error('cross-origin access denied');
    });

    const hasFocusMock = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(true);
    document.hasFocus = hasFocusMock;

    const { result } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      void result.current.printPdf('about:blank#synthetic-fallback.pdf');
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.isPrinting).toBe(false);
    expect(mockContentWindow.focus).toHaveBeenCalled();
    expect(mockContentWindow.print).toHaveBeenCalled();
  });

  it('should remove the print iframe on unmount', () => {
    const { result, unmount } = renderHook(() => useStickerPdfPrinter());

    act(() => {
      void result.current.printPdf('about:blank#synthetic-cleanup.pdf');
    });

    const iframeBeforeUnmount = document.querySelector('iframe[name="pdfPrinterFrame"]');
    expect(iframeBeforeUnmount).toBeInTheDocument();

    unmount();

    const iframeAfterUnmount = document.querySelector('iframe[name="pdfPrinterFrame"]');
    expect(iframeAfterUnmount).not.toBeInTheDocument();
  });

  it('rejects duplicate requests in the same event before a rerender', async () => {
    const { result, unmount } = renderHook(() => useStickerPdfPrinter());
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.printPdf('about:blank#synthetic-first');
      second = result.current.printPdf('about:blank#synthetic-second');
    });
    await expect(second).rejects.toThrow('Print already in progress');
    unmount();
    await expect(first).resolves.toBeUndefined();
  });

  it('cancels and settles the previous patient request and ignores a late frame load', async () => {
    const { result, rerender } = renderHook(({ patient }) => useStickerPdfPrinter(patient), {
      initialProps: { patient: 'synthetic-patient-a' },
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.printPdf('about:blank#synthetic-a');
    });
    const iframe = getPrinterFrame();
    const lateLoad = iframe.onload;
    rerender({ patient: 'synthetic-patient-b' });
    await expect(pending).resolves.toBeUndefined();
    act(() => lateLoad?.call(iframe, new Event('load')));
    expect(mockContentWindow.print).not.toHaveBeenCalled();
    expect(iframe).not.toBeInTheDocument();
    expect(result.current.isPrinting).toBe(false);
  });

  it('reports a frame load failure, removes the frame and allows retry', async () => {
    const { result } = renderHook(() => useStickerPdfPrinter());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.printPdf('about:blank#synthetic-failure');
    });
    const rejected = expect(pending).rejects.toThrow('could not be printed');
    const iframe = getPrinterFrame();
    act(() => iframe.dispatchEvent(new Event('error')));
    await rejected;
    expect(result.current.isPrinting).toBe(false);
    expect(iframe).not.toBeInTheDocument();
    expect(mockContentWindow.print).not.toHaveBeenCalled();
  });

  it('does not install more timers or print twice on repeated load events', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStickerPdfPrinter());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.printPdf('about:blank#synthetic-once');
    });
    await act(async () => {
      await Promise.resolve();
    });
    const iframe = getPrinterFrame();
    act(() => {
      iframe.dispatchEvent(new Event('load'));
      iframe.dispatchEvent(new Event('load'));
    });
    expect(mockContentWindow.print).toHaveBeenCalledOnce();
    act(() => triggerPrintCompletion());
    await pending;
    expect(iframe).not.toBeInTheDocument();
    expect(result.current.isPrinting).toBe(false);
  });

  it('fails a frame that never loads and permits a fresh print request', async () => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      set: () => undefined,
    });
    const { result, unmount } = renderHook(() => useStickerPdfPrinter());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.printPdf('about:blank#synthetic-stalled');
    });
    const rejected = expect(pending).rejects.toThrow('could not be printed');
    const iframe = getPrinterFrame();
    // Happy DOM otherwise emits its own about:blank load when the frame is appended.
    iframe.onload = null;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    await rejected;
    expect(mockContentWindow.print).not.toHaveBeenCalled();
    expect(iframe).not.toBeInTheDocument();
    expect(result.current.isPrinting).toBe(false);
    let retry!: Promise<void>;
    act(() => {
      retry = result.current.printPdf('about:blank#synthetic-retry');
    });
    expect(getPrinterFrame()).toBeInTheDocument();
    unmount();
    await expect(retry).resolves.toBeUndefined();
  });
});

function getPrinterFrame() {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[name="pdfPrinterFrame"]');
  if (!frame) throw new Error('Expected a synthetic print frame');
  return frame;
}
