import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { useAdverseReactions } from '../../workspace/adverse-reaction/adverse-reaction.resource';
import AdverseReactionsSummary from './adverse-reactions-summary.component';

vi.mock('../../workspace/adverse-reaction/adverse-reaction.resource', () => ({ useAdverseReactions: vi.fn() }));

it('formats occurrence dates and coded severity while preserving historical labels', () => {
  vi.mocked(useConfig).mockReturnValue({});
  vi.mocked(useAdverseReactions).mockReturnValue({
    reactions: [
      {
        id: 'synthetic-1',
        occurrenceDate: '2026-10-10T05:00:00.000+0000',
        vaccineName: 'BCG',
        severity: 'Severidad ESAVI leve SIH.SALUS',
        severityCode: 'mild',
        reactionDescription: 'Synthetic reaction',
      },
      {
        id: 'synthetic-2',
        occurrenceDate: 'invalid',
        vaccineName: 'BCG',
        severity: 'Historical severity',
        severityCode: undefined,
        reactionDescription: 'Historical reaction',
      },
    ],
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  });
  render(<AdverseReactionsSummary />);
  expect(
    screen.getByText(formatDate(parseDate('2026-10-10T05:00:00.000+0000'), { mode: 'standard' })),
  ).toBeInTheDocument();
  expect(screen.queryByText('2026-10-10T05:00:00.000+0000')).not.toBeInTheDocument();
  expect(screen.queryByText('Severidad ESAVI leve SIH.SALUS')).not.toBeInTheDocument();
  expect(screen.getByText('mild')).toBeInTheDocument();
  expect(screen.getByText('Historical severity')).toBeInTheDocument();
  expect(screen.getByText('--')).toBeInTheDocument();
});
