import { findOrderEncounterUuid } from './api';

describe('order encounter selection', () => {
  it('selects only the configured non-voided encounter type', () => {
    const encounters = [
      {
        uuid: 'triage-encounter',
        encounterType: { uuid: 'triage-type' },
      },
      {
        uuid: 'voided-order-encounter',
        voided: true,
        encounterType: { uuid: 'order-type' },
      },
      {
        uuid: 'order-encounter',
        encounterType: { uuid: 'order-type' },
      },
    ];

    expect(findOrderEncounterUuid(encounters, 'order-type')).toBe('order-encounter');
  });

  it('fails closed when the visit has no matching order encounter', () => {
    const encounters = [
      {
        uuid: 'triage-encounter',
        encounterType: { uuid: 'triage-type' },
      },
      {
        uuid: 'consultation-encounter',
        encounterType: 'consultation-type',
      },
    ];

    expect(findOrderEncounterUuid(encounters, 'order-type')).toBeUndefined();
  });
});
