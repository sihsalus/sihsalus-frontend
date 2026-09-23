import { adultConfig } from './adultConfig';
import { childConfig } from './childConfig';
import { getOdontogramConfig, hasOdontogramEntries } from './dentition';
import { createEmptyOdontogramData, type OdontogramData } from '../types/odontogram';

describe('dentition snapshots', () => {
  it('initializes the primary arches and spaces without permanent teeth or cross-arch pairs', () => {
    const data = createEmptyOdontogramData(childConfig);
    const upper = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
    const lower = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
    const pairs = [upper, lower].flatMap((arch) =>
      arch.slice(0, -1).map((leftToothId, i) => ({ leftToothId, rightToothId: arch[i + 1], findings: [] })),
    );
    expect(data.dentition).toBe('child');
    expect(data.teeth.map((tooth) => tooth.toothId)).toEqual([...upper, ...lower]);
    expect(data.legendSpaces).toEqual(pairs);
    for (const spaces of Object.values(data.spacingFindings)) expect(spaces).toEqual(pairs);
    expect(hasOdontogramEntries(data)).toBe(false);
  });

  it('uses the saved variant and preserves historical adult snapshots without rewriting them', () => {
    const { dentition: _, ...legacy } = createEmptyOdontogramData(adultConfig);
    expect(getOdontogramConfig(legacy)).toBe(adultConfig);
    expect(legacy).not.toHaveProperty('dentition');
    expect(getOdontogramConfig(createEmptyOdontogramData(childConfig))).toBe(childConfig);
  });

  it('does not silently reinterpret an unsupported saved dentition as permanent', () => {
    const unsupported = { ...createEmptyOdontogramData(adultConfig), dentition: 'unsupported' };
    expect(() => getOdontogramConfig(unsupported as OdontogramData)).toThrow('Unsupported odontogram dentition');
  });

  const finding = { id: 'synthetic-finding', findingId: 1, color: { id: 1, name: 'red' } };
  it.each<[string, (data: OdontogramData) => void]>([
    ['tooth finding', (data) => data.teeth[0].findings.push(finding)],
    [
      'tooth note',
      (data) => {
        data.teeth[0].notes = 'Synthetic note';
      },
    ],
    [
      'annotation',
      (data) => {
        data.teeth[0].annotations = [{ findingId: 1, text: 'CT', color: 'red' }];
      },
    ],
    ['spacing', (data) => data.spacingFindings[1][0].findings.push(finding)],
    ['legend', (data) => data.legendSpaces[0].findings.push(finding)],
    [
      'specifications',
      (data) => {
        data.especificaciones = 'Synthetic specification';
      },
    ],
    [
      'observations',
      (data) => {
        data.observaciones = 'Synthetic observation';
      },
    ],
  ])('protects %s against a destructive variant change', (_, addEntry) => {
    const data = createEmptyOdontogramData(childConfig);
    addEntry(data);
    expect(hasOdontogramEntries(data)).toBe(true);
  });
});
