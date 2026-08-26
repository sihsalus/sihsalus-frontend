import { formatPrestacionalDisplay, getCie10DisplayParts, getPrestacionalDisplayParts } from './catalog-concept.utils';

describe('catalog concept display', () => {
  it('reads CIE-10 from the concept mapping and puts it before the diagnosis name', () => {
    expect(
      getCie10DisplayParts({
        display: 'Diabetes mellitus tipo II',
        conceptMappings: [
          {
            conceptReferenceTerm: {
              code: 'E11.9',
              conceptSource: { name: 'ICD-10-WHO' },
            },
          },
        ],
      }),
    ).toEqual({ code: 'E11.9', name: 'Diabetes mellitus tipo II' });
  });

  it('keeps supporting CIE-10 codes embedded in legacy concept displays', () => {
    expect(
      getCie10DisplayParts({
        display: 'TRASTORNO MENTAL (F15.5)',
      }),
    ).toEqual({ code: 'F15.5', name: 'TRASTORNO MENTAL' });
  });

  it('reads a FUA prestational code from its SIS mapping without duplicating it', () => {
    const concept = {
      display: 'Consulta externa',
      conceptMappings: [
        {
          conceptReferenceTerm: {
            code: '056',
            conceptSource: { name: 'SIS' },
          },
        },
      ],
    };

    expect(getPrestacionalDisplayParts(concept)).toEqual({
      code: '056',
      name: 'Consulta externa',
    });
    expect(formatPrestacionalDisplay(concept)).toBe('056 - Consulta externa');
    expect(formatPrestacionalDisplay({ display: '056 - Consulta externa' })).toBe('056 - Consulta externa');
  });
});
