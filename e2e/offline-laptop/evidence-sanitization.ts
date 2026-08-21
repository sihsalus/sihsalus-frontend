export interface PendingSyncItemEvidenceSource {
  lastError?: unknown;
  type?: string;
}

export function formatHttpFailure(message: string, status: number): string {
  return `${message} (${status})`;
}

export function summarizePendingSyncItems(items: Array<PendingSyncItemEvidenceSource>) {
  return items.map((item) => ({
    hasStoredError: Boolean(item.lastError),
    type: item.type,
  }));
}
