export interface AuditEvent {
  eventType: string;
  patientUuid?: string;
  encounterUuid?: string;
  locationUuid?: string;
  resourceType?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  userUuid: string;
  sessionId: string;
}

export interface AuditLoggerConfig {
  endpoint?: string;
  dbName?: string;
  maxOfflineEntries?: number;
}

export interface StoredAuditEntry extends AuditEvent {
  id: string;
}
