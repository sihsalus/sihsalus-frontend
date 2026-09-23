import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DESIGN_COMPONENT_MAP, TOOTH_DESIGN_COMPONENT_MAP } from '../components/constants';
import FormDentalClinicalFindings from '../components/FormDentalClinicalFindings';
import ToothVisualization from '../components/ToothVisualization';
import { getPolygonPoints } from '../poligonPoints/ToothPolygonDesigns';
import { OdontogramProvider } from '../providers/OdontogramProvider';
import { createEmptyOdontogramData, type FindingDesign, type OdontogramData } from '../types/odontogram';
import { childConfig } from './childConfig';

const compatible = (design: FindingDesign, zones: number) =>
  !design.zones || (Array.isArray(design.zones) ? design.zones.includes(zones) : design.zones === zones);

describe('primary molar surfaces', () => {
  it('resolves the shared catalog to the same component in the picker and saved findings', () => {
    for (const option of childConfig.findingOptions) {
      for (const design of option.designs ?? []) {
        expect(DESIGN_COMPONENT_MAP[design.componente], design.componente).toBeDefined();
        expect(DESIGN_COMPONENT_MAP[design.componente]).toBe(TOOTH_DESIGN_COMPONENT_MAP[option.id]?.[design.number]);
      }
    }
  });

  it.each([
    [54, 7],
    [64, 7],
    [85, 10],
    [75, 10],
  ])('renders the %i crown with %i distinct zones', (toothId, zones) => {
    const tooth = [...childConfig.teeth.upper, ...childConfig.teeth.lower].find((tooth) => tooth.id === toothId);
    expect(tooth?.zones).toBe(zones);
    const polygons = getPolygonPoints(zones);
    expect(polygons).toHaveLength(zones);
    // Every sample point in the crown belongs to exactly one zone: no gaps or overlaps.
    const contains = (polygon: string, x: number, y: number) => {
      const vertices = polygon.split(' ').map((point) => point.split(',').map(Number));
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [xi, yi] = vertices[i];
        const [xj, yj] = vertices[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    for (let x = 0.37; x < 20; x += 0.5) {
      for (let y = 0.19; y < 20; y += 0.5) {
        expect(polygons.filter((polygon) => contains(polygon, x, y))).toHaveLength(1);
      }
    }
  });

  it.each([
    5, 16, 34, 35,
  ])('offers every crown surface for finding %i and preserves the existing design identities', (id) => {
    const option = childConfig.findingOptions.find((finding) => finding.id === id);
    const designs = option?.designs ?? [];
    expect(designs.filter((design) => compatible(design, 7)).map((design) => design.number)).toEqual([
      5, 6, 7, 8, 10, 11, 12,
    ]);
    expect(designs.filter((design) => compatible(design, 10)).map((design) => design.number)).toEqual([
      5, 6, 7, 8, 15, 16, 17, 18, 19, 20,
    ]);
    expect(designs.filter((design) => compatible(design, 8)).map((design) => design.number)).toEqual([
      5, 6, 7, 8, 11, 12, 13, 14,
    ]);
    expect(designs.filter((design) => compatible(design, 6)).map((design) => design.number)).toEqual([
      5, 6, 7, 8, 9, 10,
    ]);
    expect(designs.filter((design) => compatible(design, 4)).map((design) => design.number)).toEqual([1, 2, 3, 4]);
    for (const design of designs) {
      expect(DESIGN_COMPONENT_MAP[design.componente]).toBe(TOOTH_DESIGN_COMPONENT_MAP[id][design.number]);
      expect(DESIGN_COMPONENT_MAP[design.componente]).toBeDefined();
    }
  });

  it.each([10, 27, 36, 37])('retains usable designs for finding %i on both new crowns', (id) => {
    const designs = childConfig.findingOptions.find((finding) => finding.id === id)?.designs ?? [];
    for (const zones of [7, 10]) {
      const available = designs.filter((design) => compatible(design, zones));
      expect(available.length).toBeGreaterThan(0);
      for (const design of available) expect(DESIGN_COMPONENT_MAP[design.componente]).toBeDefined();
    }
  });

  it('draws the new filled and outlined findings on the same six inner surfaces as the tooth', () => {
    for (const id of [5, 16, 34, 35]) {
      for (let number = 15; number <= 20; number++) {
        const Finding = TOOTH_DESIGN_COMPONENT_MAP[id][number];
        const { container, unmount } = render(<Finding strokeColor="red" />);
        const polygon = container.querySelector('polygon');
        expect(polygon).toHaveAttribute('points', getPolygonPoints(10)[number - 15 + 4]);
        expect(polygon).toHaveAttribute('fill', id === 35 ? 'none' : 'red');
        if (id === 35) expect(polygon).toHaveAttribute('stroke', 'red');
        expect(container.querySelector('svg')).toHaveAttribute('y', '60');
        unmount();
      }
    }
  });
});

function PrimaryToothEditor({ toothId }: { toothId: number }) {
  const [data, setData] = useState<OdontogramData>(() => createEmptyOdontogramData(childConfig));
  const [readOnly, setReadOnly] = useState(false);
  const tooth = [...childConfig.teeth.upper, ...childConfig.teeth.lower].find((tooth) => tooth.id === toothId);
  if (!tooth) throw new Error('Missing synthetic tooth');
  return (
    <>
      <OdontogramProvider config={childConfig} data={data} onChange={setData} readOnly={readOnly}>
        <FormDentalClinicalFindings />
        <ToothVisualization idTooth={toothId} zones={tooth.zones} design={tooth.rootDesign} position={tooth.position} />
      </OdontogramProvider>
      <button
        type="button"
        onClick={() => {
          setData(JSON.parse(JSON.stringify(data)));
          setReadOnly(true);
        }}
      >
        Reload snapshot
      </button>
      <button type="button" onClick={() => setReadOnly(false)}>
        Edit snapshot
      </button>
      <output data-testid="snapshot">{JSON.stringify(data)}</output>
    </>
  );
}

it.each([
  [54, 10],
  [64, 11],
  [85, 15],
  [75, 20],
])('selects, reloads and removes a caries finding on tooth %i (design %i)', async (toothId, designNumber) => {
  const user = userEvent.setup();
  render(<PrimaryToothEditor toothId={toothId} />);
  const selectCaries = async () => {
    await user.click(screen.getByRole('button', { name: 'Seleccionar hallazgo...' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Seleccionar hallazgo' })).getByRole('button', {
        name: 'Lesión de caries dental',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'MB' }));
    await user.click(screen.getByRole('button', { name: `Diente ${toothId}` }));
  };
  await selectCaries();
  await user.click(screen.getByRole('button', { name: `Diseño ${designNumber}`, exact: true }));
  await user.click(
    within(screen.getByRole('dialog', { name: /^Seleccionar diseño/ })).getByRole('button', { name: 'Cerrar' }),
  );
  const selected = JSON.parse(screen.getByTestId('snapshot').textContent ?? '');
  expect(selected.dentition).toBe('child');
  expect(selected.teeth.find((tooth: { toothId: number }) => tooth.toothId === toothId).findings).toEqual([
    expect.objectContaining({ findingId: 16, designNumber, subOptionId: 1601, color: { id: 102, name: 'red' } }),
  ]);
  await user.click(screen.getByRole('button', { name: 'Reload snapshot' }));
  expect(JSON.parse(screen.getByTestId('snapshot').textContent ?? '')).toEqual(selected);
  expect(screen.getByRole('button', { name: `Diente ${toothId}` })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Edit snapshot' }));
  await selectCaries();
  await user.click(screen.getByRole('button', { name: new RegExp(`^Diseño ${designNumber} Aplicado`) }));
  const edited = JSON.parse(screen.getByTestId('snapshot').textContent ?? '');
  expect(edited.teeth.find((tooth: { toothId: number }) => tooth.toothId === toothId).findings).toEqual([]);
});
