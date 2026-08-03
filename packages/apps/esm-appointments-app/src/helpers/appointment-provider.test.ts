import { type Appointment } from '../types';
import { getAppointmentProviderName } from './appointment-provider';

describe('getAppointmentProviderName', () => {
  it('prefers the accepted provider when the backend returns several responses', () => {
    const appointment = {
      provider: { display: 'Profesional heredado' },
      providers: [
        { display: 'Profesional rechazado', response: 'DECLINED' },
        { display: 'Dra. Ana Torres', response: 'ACCEPTED' },
      ],
    } as unknown as Appointment;

    expect(getAppointmentProviderName(appointment)).toBe('Dra. Ana Torres');
  });

  it('supports the legacy singular provider with a nested person', () => {
    const appointment = {
      provider: { person: { display: 'Dr. Luis Ramos' } },
      providers: [],
    } as unknown as Appointment;

    expect(getAppointmentProviderName(appointment)).toBe('Dr. Luis Ramos');
  });

  it('does not expose a UUID when no provider name was returned', () => {
    const appointment = {
      provider: { uuid: 'provider-uuid' },
      providers: [{ uuid: 'provider-uuid', response: 'ACCEPTED' }],
    } as unknown as Appointment;

    expect(getAppointmentProviderName(appointment)).toBeUndefined();
  });
});
