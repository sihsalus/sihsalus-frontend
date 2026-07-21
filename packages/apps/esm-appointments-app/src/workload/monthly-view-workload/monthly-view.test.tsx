import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MonthlyCalendarView from './monthly-view.component';

describe('MonthlyCalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a Carbon-styled, localized calendar with workload counts', () => {
    render(
      <MonthlyCalendarView
        calendarWorkload={[{ date: '2026-07-21', count: 3 }]}
        displayedMonth={new Date(2026, 6, 1)}
        minDate={new Date(2026, 6, 20)}
        onDateClick={vi.fn()}
        onMonthChange={vi.fn()}
        selectedDate={new Date(2026, 6, 20)}
      />,
    );

    expect(screen.getByRole('grid')).toHaveAccessibleName(/july 2026|julio.*2026/i);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('button', { name: /21.*3 scheduled appointments?/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /19.*0 scheduled appointments?/i })).toBeDisabled();
    expect(screen.getByRole('gridcell', { selected: true })).toHaveTextContent('20');
  });

  it('navigates between months and selects an enabled date', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onMonthChange = vi.fn();
    render(
      <MonthlyCalendarView
        calendarWorkload={[]}
        displayedMonth={new Date(2026, 6, 1)}
        minDate={new Date(2026, 6, 20)}
        onDateClick={onDateClick}
        onMonthChange={onMonthChange}
        selectedDate={new Date(2026, 6, 20)}
      />,
    );

    await user.click(screen.getByRole('button', { name: /next month/i }));
    expect(onMonthChange).toHaveBeenCalledWith(expect.any(Date));
    expect(onMonthChange.mock.calls[0][0].getMonth()).toBe(7);

    await user.click(screen.getByRole('button', { name: /21.*0 scheduled appointments?/i }));
    expect(onDateClick).toHaveBeenCalledWith(expect.any(Date));
    expect(onDateClick.mock.calls[0][0].getDate()).toBe(21);
  });
});
