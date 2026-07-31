import { type Appointment } from '../types';

type AppointmentProviderResource = {
  display?: unknown;
  name?: unknown;
  person?: {
    display?: unknown;
    name?: unknown;
  } | null;
  response?: unknown;
};

function normalizeDisplayValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getProviderDisplayName(provider?: AppointmentProviderResource | null): string | undefined {
  return (
    normalizeDisplayValue(provider?.person?.display) ??
    normalizeDisplayValue(provider?.person?.name) ??
    normalizeDisplayValue(provider?.display) ??
    normalizeDisplayValue(provider?.name)
  );
}

/**
 * Resolves the professional assigned to an appointment across the response shapes
 * returned by the appointments backend. An accepted provider takes precedence,
 * followed by the legacy singular provider and finally the first named provider.
 */
export function getAppointmentProviderName(appointment?: Appointment | null): string | undefined {
  const providers = (appointment?.providers ?? []) as Array<AppointmentProviderResource>;
  const acceptedProvider = providers.find(
    (provider) => normalizeDisplayValue(provider.response)?.toLocaleUpperCase() === 'ACCEPTED' && getProviderDisplayName(provider),
  );

  return (
    getProviderDisplayName(acceptedProvider) ??
    getProviderDisplayName(appointment?.provider as AppointmentProviderResource | undefined) ??
    providers.map(getProviderDisplayName).find(Boolean)
  );
}
