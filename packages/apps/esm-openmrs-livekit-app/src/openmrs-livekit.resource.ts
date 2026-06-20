import type { ReviewBundle } from './types';

export async function getReviewBundle(abortController?: AbortController): Promise<ReviewBundle> {
  const response = await fetch('/services/openmrs-livekit/review-bundle', {
    headers: {
      Accept: 'application/json',
    },
    signal: abortController?.signal,
  });

  if (!response.ok) {
    throw new Error(`OpenMRS LiveKit service returned HTTP ${response.status}`);
  }

  return response.json();
}

export function getDemoReviewBundle(): ReviewBundle {
  return {
    serviceStatus: 'degraded',
    generatedAt: new Date().toISOString(),
    translationTurns: [
      {
        speaker: 'clinician',
        sourceLanguage: 'es-PE',
        targetLanguage: 'es-claro',
        sourceText: 'Dile a Juana Perez que no duplique la metformina el 12/06/2026.',
        safeSourceText: 'Dile a <KNOWN_ENTITY_1:725d7210> que no duplique la metformina el <DATE_1:b760988f>.',
        translatedText: 'No tome doble dosis de metformina. Espere la indicacion del personal de salud.',
        redactionCount: 2,
      },
      {
        speaker: 'patient',
        sourceLanguage: 'es-PE',
        targetLanguage: 'es-clinico',
        sourceText: 'No soy alergica a medicamentos, pero me mareo en las mananas.',
        safeSourceText: 'No soy alergica a medicamentos, pero me mareo en las mananas.',
        translatedText: 'La paciente niega alergias medicamentosas y refiere mareos matutinos.',
        redactionCount: 0,
      },
    ],
    reviewQueue: [
      {
        kind: 'dizziness',
        value: 'Mareos matutinos',
        confidence: 0.74,
        evidence: 'me mareo en las mananas',
        speaker: 'patient',
        status: 'needs_review',
      },
    ],
    missingFields: ['Inicio de mareos', 'Duracion del sintoma'],
    openmrsDraft: {
      patient: 'synthetic-patient-uuid',
      encounterType: 'synthetic-encounter-type-uuid',
      location: 'synthetic-location-uuid',
      visit: 'synthetic-visit-uuid',
      obs: [
        {
          concept: 'concept-allergy-denial',
          value: 'No known drug allergies',
          comment:
            'compiler_fact=allergy_denial | confidence=0.96 | speaker=patient | evidence=No soy alergica a medicamentos',
        },
      ],
    },
  };
}
