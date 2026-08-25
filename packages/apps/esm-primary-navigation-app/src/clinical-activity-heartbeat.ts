export const clinicalActivityHeartbeatUrl = '/_sihsalus/clinical-activity';
export const clinicalActivityHeartbeatIntervalMs = 30_000;
export const clinicalActivityRecentInteractionMs = 30 * 60_000;

const clinicalActivityEvents = ['input', 'keydown', 'pointerdown', 'touchstart'] as const;

let heartbeatIntervalId: number | undefined;
let lastInteractionAt = 0;

function noteClinicalInteraction() {
  lastInteractionAt = Date.now();
}

function sendClinicalActivityHeartbeat() {
  if (document.visibilityState !== 'visible' || Date.now() - lastInteractionAt > clinicalActivityRecentInteractionMs) {
    return;
  }

  void fetch(clinicalActivityHeartbeatUrl, {
    method: 'POST',
    body: null,
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
    referrerPolicy: 'no-referrer',
  }).catch(() => undefined);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    noteClinicalInteraction();
    sendClinicalActivityHeartbeat();
  }
}

/**
 * Emits a PHI-free presence signal for the host's guarded poweroff policy.
 * The signal contains no patient, user, route, form, or queue context.
 */
export function setupClinicalActivityHeartbeat() {
  if (
    heartbeatIntervalId !== undefined ||
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof fetch !== 'function'
  ) {
    return;
  }

  noteClinicalInteraction();
  for (const eventName of clinicalActivityEvents) {
    document.addEventListener(eventName, noteClinicalInteraction, { passive: true });
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  sendClinicalActivityHeartbeat();
  heartbeatIntervalId = window.setInterval(sendClinicalActivityHeartbeat, clinicalActivityHeartbeatIntervalMs);
}

export function stopClinicalActivityHeartbeat() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    heartbeatIntervalId = undefined;
    lastInteractionAt = 0;
    return;
  }

  if (heartbeatIntervalId !== undefined) {
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = undefined;
  }
  for (const eventName of clinicalActivityEvents) {
    document.removeEventListener(eventName, noteClinicalInteraction);
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  lastInteractionAt = 0;
}
