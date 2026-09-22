import { render, screen, within } from '@testing-library/react';
import { getDefaultsFromConfigSchema, UserHasAccess, useConfig, useLayoutType } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import OutPatientSocialHistory from './patient-social-history.component';
import { configSchema } from '../../../config-schema';
import { useSocialHistory } from '../../../hooks/useSocialHistory';
import { useSocialHistoryFormLauncher } from '../../../hooks/useSocialHistoryFormLauncher';

vi.mock('../../../hooks/useSocialHistory', () => ({ useSocialHistory: vi.fn() }));
vi.mock('../../../hooks/useSocialHistoryFormLauncher', () => ({ useSocialHistoryFormLauncher: vi.fn() }));
const config = getDefaultsFromConfigSchema(configSchema);
const launch = vi.fn();
const refresh = vi.fn();
const legacyRefresh = vi.fn();
const concepts = config.socialHistory.concepts;
const currentRecord = {
  uuid: 'synthetic-current',
  encounterDatetime: '2026-09-21T10:00:00Z',
  obs: [
    { concept: { uuid: concepts.alcohol }, value: { uuid: concepts.no, display: 'NO' } },
    { concept: { uuid: concepts.tobacco }, value: { uuid: concepts.yes, display: 'YES' } },
    { concept: { uuid: concepts.cigarettesPerDay }, value: 0 },
  ],
};
const legacyRecord = {
  uuid: 'synthetic-previous',
  encounterDatetime: '2026-09-20T10:00:00Z',
  obs: [{ concept: { uuid: config.concepts.alcoholUseUuid }, value: 'Previous value' }],
};
const props = {
  patientUuid: 'synthetic-patient',
  encounters: [legacyRecord],
  isLoading: false,
  isValidating: false,
  error: undefined,
  mutate: legacyRefresh,
} as never;
const history = {
  data: [currentRecord],
  isLoading: false,
  isValidating: false,
  error: undefined,
  truncated: false,
  mutate: refresh,
  pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(useSocialHistory).mockReturnValue(history as never);
  vi.mocked(useSocialHistoryFormLauncher).mockReturnValue(launch);
  vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
  vi.mocked(useLayoutType).mockReturnValue('small-desktop');
});

it('renders current and historical values separately, preserves zero and does not infer missing answers', () => {
  render(<OutPatientSocialHistory {...props} />);
  const current = within(screen.getByRole('table', { name: 'Social History' }));
  expect(current.getByRole('cell', { name: 'No' })).toBeInTheDocument();
  expect(current.getByRole('cell', { name: 'Yes' })).toBeInTheDocument();
  expect(current.getByRole('cell', { name: '0' })).toBeInTheDocument();
  expect(current.getByRole('cell', { name: '--' })).toBeInTheDocument();
  const previous = within(screen.getByRole('table', { name: 'Previous social history records' }));
  expect(previous.getByRole('cell', { name: 'Previous value' })).toBeInTheDocument();
  expect(previous.queryByRole('button')).not.toBeInTheDocument();
  expect(previous.getByRole('columnheader', { name: 'Tobacco use status' })).toBeInTheDocument();
});

it('uses the shared registration toolbar and edits the selected encounter', async () => {
  const user = userEvent.setup();
  render(<OutPatientSocialHistory {...props} />);
  await user.click(screen.getByRole('button', { name: 'Record social history' }));
  expect(launch).toHaveBeenLastCalledWith();
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  expect(launch).toHaveBeenLastCalledWith('synthetic-current');
  const mutate = vi.mocked(useSocialHistoryFormLauncher).mock.calls[0][1];
  await mutate();
  expect(refresh).toHaveBeenCalledOnce();
  expect(legacyRefresh).toHaveBeenCalledOnce();
});

it('keeps both histories visible without edit privilege', () => {
  vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);
  render(<OutPatientSocialHistory {...props} />);
  expect(screen.getAllByRole('table')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record social history' })).not.toBeInTheDocument();
});

it('uses the same tablet table sizing as other clinical cards', () => {
  vi.mocked(useLayoutType).mockReturnValue('tablet');
  render(<OutPatientSocialHistory {...props} />);
  expect(screen.getByRole('table', { name: 'Social History' })).toHaveClass('cds--data-table--lg');
});

it('preserves labels for deployments with custom legacy concepts', () => {
  vi.mocked(useConfig).mockReturnValue({
    ...config,
    concepts: {
      ...config.concepts,
      alcoholUseDurationUuid: 'custom-alcohol',
      otherSubstanceAbuseUuid: 'custom-substance',
    },
  });
  render(<OutPatientSocialHistory {...props} />);
  const previous = within(screen.getByRole('table', { name: 'Previous social history records' }));
  expect(previous.getByRole('columnheader', { name: 'Alcohol Use Duration' })).toBeInTheDocument();
  expect(previous.getByRole('columnheader', { name: 'Other Substance Abuse' })).toBeInTheDocument();
});

it.each([
  { error: new Error('private-server-detail') },
  { truncated: true },
])('does not present a failed or truncated source as an empty history', (state) => {
  vi.mocked(useSocialHistory).mockReturnValue({ ...history, data: [], ...state } as never);
  render(<OutPatientSocialHistory {...props} />);
  expect(screen.queryByRole('table', { name: 'Social History' })).not.toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Previous social history records' })).toBeInTheDocument();
  expect(screen.queryByText('private-server-detail')).not.toBeInTheDocument();
});

it('shows loading feedback through the shared card', () => {
  vi.mocked(useSocialHistory).mockReturnValue({ ...history, data: [], isLoading: true } as never);
  render(<OutPatientSocialHistory {...props} />);
  expect(screen.getByRole('progressbar', { name: 'Social History' })).toBeInTheDocument();
});
