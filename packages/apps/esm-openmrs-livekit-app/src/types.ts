export type LivekitServiceStatus = 'ready' | 'degraded' | 'offline';

export interface TranslationTurn {
  speaker: 'clinician' | 'patient' | 'caregiver' | 'interpreter' | 'unknown';
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  safeSourceText: string;
  translatedText: string;
  redactionCount: number;
}

export interface ReviewFact {
  kind: string;
  value: string;
  confidence: number;
  evidence: string;
  speaker?: string;
  status: 'detected' | 'needs_review' | 'approved' | 'rejected';
}

export interface OpenmrsDraftPayload {
  patient: string;
  encounterType: string;
  location: string;
  visit?: string;
  obs: Array<{
    concept: string;
    value: string;
    comment?: string;
  }>;
}

export interface ReviewBundle {
  serviceStatus: LivekitServiceStatus;
  generatedAt: string;
  translationTurns: TranslationTurn[];
  reviewQueue: ReviewFact[];
  missingFields: string[];
  openmrsDraft: OpenmrsDraftPayload;
}
