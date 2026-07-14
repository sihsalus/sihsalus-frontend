import { mapVisitObservations } from './active-visits.resource';

describe('mapVisitObservations', () => {
  it('returns an empty observation map when a visit has no encounters property', () => {
    expect(mapVisitObservations(undefined)).toEqual({});
  });

  it('groups observations from all encounters by concept', () => {
    const encounters = [
      {
        obs: [
          {
            uuid: 'obs-1',
            concept: { uuid: 'concept-1' },
            value: 'first value',
          },
        ],
      },
      {
        obs: [
          {
            uuid: 'obs-2',
            concept: { uuid: 'concept-1' },
            value: 'second value',
          },
        ],
      },
    ];

    expect(mapVisitObservations(encounters as never)).toEqual({
      'concept-1': [
        { uuid: 'obs-1', value: 'first value' },
        { uuid: 'obs-2', value: 'second value' },
      ],
    });
  });
});
