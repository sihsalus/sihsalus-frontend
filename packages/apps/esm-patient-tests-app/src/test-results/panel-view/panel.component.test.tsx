import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type ObsRecord } from '../../types';
import { getClass } from './helper';
import LabSetPanel from './panel.component';

const expectHasClass = (element: HTMLElement, className: string) => {
  if (className) {
    expect(element).toHaveClass(className);
  }
};

const mockUseLayoutType = vi.mocked(useLayoutType);
const mockIsDesktop = vi.mocked(isDesktop);

const conceptMeta = {
  display: 'Complete Blood Count',
  hiNormal: 16,
  hiAbsolute: 20,
  hiCritical: 18,
  lowNormal: 12,
  lowAbsolute: 0,
  lowCritical: 10,
  units: 'g/dL',
  getInterpretation: vi.fn(),
  range: '12-16',
};

const basePanel: ObsRecord = {
  resourceType: 'Observation',
  id: 'panel-1',
  category: [],
  code: { coding: [], text: 'Complete Blood Count' },
  effectiveDateTime: '2024-01-01T10:00:00Z',
  issued: '2024-01-01T10:00:00Z',
  referenceRange: [],
  conceptUuid: 'cbc-uuid',
  relatedObs: [],
  meta: conceptMeta,
  value: '',
  name: 'Complete Blood Count',
  interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
};

const mockObservations: Array<ObsRecord> = [
  {
    ...basePanel,
    id: '1',
    name: 'Hemoglobin',
    value: '14',
    interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
    meta: { ...conceptMeta, units: 'g/dL', range: '12-16' },
  },
  {
    ...basePanel,
    id: '2',
    name: 'Hematocrit',
    value: '42',
    interpretation: 'HIGH' as OBSERVATION_INTERPRETATION,
    meta: { ...conceptMeta, units: '%', range: '35-45' },
  },
];

const mockObservationsWithInterpretations: Array<ObsRecord> = [
  {
    ...basePanel,
    id: '1',
    name: 'Normal test',
    value: '14',
    interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
    meta: { ...conceptMeta },
  },
  {
    ...basePanel,
    id: '2',
    name: 'High test',
    value: '42',
    interpretation: 'HIGH' as OBSERVATION_INTERPRETATION,
    meta: { ...conceptMeta },
  },
  {
    ...basePanel,
    id: '3',
    name: 'Low test',
    value: '2',
    interpretation: 'LOW' as OBSERVATION_INTERPRETATION,
    meta: { ...conceptMeta },
  },
];

describe('LabSetPanel', () => {
  const user = userEvent.setup();
  const mockSetActivePanel = vi.fn();

  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('large-desktop');
    mockIsDesktop.mockReturnValue(true);
  });

  it('renders the panel header, columns, and observations when provided', () => {
    render(
      <LabSetPanel
        activePanel={null}
        observations={mockObservations}
        panel={basePanel}
        setActivePanel={mockSetActivePanel}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /complete blood count/i })).toBeInTheDocument();
    expect(screen.getByText(/01 — Jan — 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/\d{2}:\d{2}/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /test name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /value/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /reference range/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hemoglobin 14 g\/dL 12-16 g\/dL/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hematocrit 42 % 35-45 %/i })).toBeInTheDocument();
  });

  it('clicking on the panel header sets the active panel', async () => {
    render(
      <LabSetPanel
        activePanel={null}
        observations={mockObservations}
        panel={basePanel}
        setActivePanel={mockSetActivePanel}
      />,
    );

    const buttonElement = screen.getByRole('button');
    await user.click(buttonElement);
    expect(mockSetActivePanel).toHaveBeenCalledWith(basePanel);
  });

  it('renders the panel without reference ranges when not provided', () => {
    const panelWithoutRange = {
      ...basePanel,
      meta: {
        ...conceptMeta,
        range: undefined,
      },
    } as ObsRecord;

    const observationsWithoutRange: Array<ObsRecord> = [
      {
        ...basePanel,
        id: '1',
        name: 'Hemoglobin',
        value: '14',
        interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
        meta: { ...conceptMeta, units: 'g/dL', range: undefined },
      },
      {
        ...basePanel,
        id: '2',
        name: 'Hematocrit',
        value: '42',
        interpretation: 'HIGH' as OBSERVATION_INTERPRETATION,
        meta: { ...conceptMeta, units: '%', range: undefined },
      },
    ];

    render(
      <LabSetPanel
        activePanel={null}
        observations={observationsWithoutRange}
        panel={panelWithoutRange}
        setActivePanel={mockSetActivePanel}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /test name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /value/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /reference range/i })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hemoglobin 14 g\/dL/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hematocrit 42 %/i })).toBeInTheDocument();
  });

  it('correctly highlights the interpretation of the observations', () => {
    render(
      <LabSetPanel
        activePanel={null}
        observations={mockObservationsWithInterpretations}
        panel={basePanel}
        setActivePanel={mockSetActivePanel}
      />,
    );

    const normalTest = screen.getByRole('row', { name: /normal test 14 g\/dL 12-16 g\/dL/i });
    const highTest = screen.getByRole('row', { name: /high test 42 g\/dL 12-16 g\/dL/i });
    const lowTest = screen.getByRole('row', { name: /low test 2 g\/dL 12-16 g\/dL/i });

    expect(normalTest).toHaveClass('check');
    expectHasClass(highTest, getClass('HIGH'));
    expectHasClass(lowTest, getClass('LOW'));
  });

  it('adjusts the table size based on the layout', () => {
    const { rerender } = render(
      <LabSetPanel
        activePanel={null}
        observations={mockObservations}
        panel={basePanel}
        setActivePanel={mockSetActivePanel}
      />,
    );

    expect(screen.getByRole('table')).toHaveClass('cds--data-table--sm');

    mockUseLayoutType.mockReturnValue('tablet');
    mockIsDesktop.mockReturnValue(false);

    rerender(
      <LabSetPanel
        activePanel={null}
        observations={mockObservations}
        panel={basePanel}
        setActivePanel={mockSetActivePanel}
      />,
    );

    expect(screen.getByRole('table')).toHaveClass('cds--data-table--md');
  });
});
