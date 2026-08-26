import { downloadOutpatientVisitSummaryPdf } from './outpatient-visit-summary-pdf';

const PRINT_RESOURCE_TIMEOUT_MS = 15_000;

export type PdfPrintOutcome = 'print-requested' | 'downloaded' | 'cancelled' | 'content-stale';

export interface PdfPrintOptions {
  isContentCurrent?: () => boolean;
  signal?: AbortSignal;
}

function isPdfContentCurrent(options: PdfPrintOptions): boolean {
  try {
    return options.isContentCurrent?.() ?? true;
  } catch {
    return false;
  }
}

/**
 * Requests the browser print dialog for a locally generated PDF. If the
 * embedded viewer does not load, it downloads the same bytes so the clinician
 * can print them from the native PDF viewer.
 */
export function printPdfBytes(
  bytes: Uint8Array,
  fallbackFileName: string,
  options: PdfPrintOptions = {},
): Promise<PdfPrintOutcome> {
  if (options.signal?.aborted) return Promise.resolve('cancelled');
  if (!isPdfContentCurrent(options)) return Promise.resolve('content-stale');

  let objectUrl: string;
  try {
    objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let iframe: HTMLIFrameElement;
    try {
      iframe = document.createElement('iframe');
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      reject(error);
      return;
    }

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let loadHandled = false;
    let settled = false;
    let printInvocationStarted = false;
    let cleanedUp = false;

    function handleAbort() {
      const wasSettled = settled;
      settled = true;
      cleanup();
      if (!wasSettled) resolve('cancelled');
    }

    function handleStaleContent() {
      const wasSettled = settled;
      settled = true;
      cleanup();
      if (!wasSettled) resolve('content-stale');
    }

    function canExposeContent() {
      if (options.signal?.aborted) {
        handleAbort();
        return false;
      }
      if (!isPdfContentCurrent(options)) {
        handleStaleContent();
        return false;
      }
      return true;
    }

    const restoreFocus = () => {
      setTimeout(() => {
        if (!previouslyFocusedElement?.isConnected) return;
        try {
          previouslyFocusedElement.focus();
        } catch {
          // Focus restoration is best effort after the browser print UI closes.
        }
      }, 0);
    };

    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      options.signal?.removeEventListener('abort', handleAbort);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      iframe.onload = null;
      iframe.onerror = null;
      try {
        iframe.remove();
      } catch {
        // The iframe may already have been removed by the browser.
      }
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Revocation is best effort when the browser has already discarded it.
      }
      restoreFocus();
    }

    const rejectWithCleanup = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const downloadFallback = () => {
      if (settled) return;
      if (!canExposeContent()) return;
      settled = true;
      cleanup();
      try {
        downloadOutpatientVisitSummaryPdf(bytes, fallbackFileName);
        resolve('downloaded');
      } catch (error) {
        reject(error);
      }
    };

    const handleTimeout = () => {
      if (!canExposeContent()) return;
      if (!printInvocationStarted) {
        downloadFallback();
        return;
      }
      if (!settled) {
        settled = true;
        resolve('print-requested');
      }
      cleanup();
    };

    try {
      iframe.name = 'outpatientPatientInstructionsPdfPrinter';
      iframe.tabIndex = -1;
      iframe.setAttribute('aria-hidden', 'true');
      Object.assign(iframe.style, {
        border: 'none',
        height: '0',
        pointerEvents: 'none',
        position: 'fixed',
        visibility: 'hidden',
        width: '0',
      });

      iframe.onerror = downloadFallback;
      iframe.onload = () => {
        if (loadHandled || settled) return;
        if (!canExposeContent()) return;
        loadHandled = true;
        try {
          const printWindow = iframe.contentWindow;
          if (!printWindow || typeof printWindow.print !== 'function') {
            downloadFallback();
            return;
          }

          try {
            printWindow.addEventListener('afterprint', cleanup, { once: true });
          } catch {
            // Some embedded PDF viewers do not expose DOM events. The timeout
            // still releases the Blob URL and iframe.
          }
          printWindow.focus();
          if (!canExposeContent()) return;
          printInvocationStarted = true;
          printWindow.print();
          if (!settled) {
            settled = true;
            resolve('print-requested');
          }
        } catch {
          downloadFallback();
        }
      };

      cleanupTimer = setTimeout(handleTimeout, PRINT_RESOURCE_TIMEOUT_MS);
      options.signal?.addEventListener('abort', handleAbort, { once: true });
      if (options.signal?.aborted) {
        handleAbort();
        return;
      }
      iframe.src = objectUrl;
      document.body.appendChild(iframe);
    } catch (error) {
      rejectWithCleanup(error);
    }
  });
}
