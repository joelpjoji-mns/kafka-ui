import React from 'react';
import { render } from 'lib/testHelpers';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartitionCounts from 'components/Topics/Topic/Messages/Filters/PartitionCounts';
import TimeRangeSelector from 'components/Topics/Topic/Messages/Filters/TimeRangeSelector';

describe('PartitionCounts', () => {
  it('renders nothing when total is 0', () => {
    render(<PartitionCounts partitionCounts={{}} total={0} />);
    expect(
      screen.queryByTestId('partition-counts-total')
    ).not.toBeInTheDocument();
  });

  it('shows total and per-partition pills sorted by partition', () => {
    render(
      <PartitionCounts
        partitionCounts={{ 3: 2, 0: 5, 2: 1 }}
        total={8}
      />
    );

    expect(screen.getByTestId('partition-counts-total')).toHaveTextContent('8');

    expect(screen.getByTestId('partition-count-0')).toHaveTextContent(/P0\s*5/);
    expect(screen.getByTestId('partition-count-2')).toHaveTextContent(/P2\s*1/);
    expect(screen.getByTestId('partition-count-3')).toHaveTextContent(/P3\s*2/);

    const pillsInDom = [
      screen.getByTestId('partition-count-0'),
      screen.getByTestId('partition-count-2'),
      screen.getByTestId('partition-count-3'),
    ];
    for (let i = 1; i < pillsInDom.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      const positional =
        pillsInDom[i - 1].compareDocumentPosition(pillsInDom[i]);
      expect(positional & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('TimeRangeSelector', () => {
  const setup = (start: Date | null = null, end: Date | null = null) => {
    const onApply = jest.fn();
    render(
      <TimeRangeSelector start={start} end={end} onApply={onApply} />
    );
    return { onApply };
  };

  it('renders the compact preset select and the timezone badge', async () => {
    setup();
    const presetSelect = screen.getByTestId('time-range-preset-select');
    expect(presetSelect).toBeInTheDocument();

    await userEvent.click(presetSelect);

    ['Last 1h', 'Last 1 day', 'Last 7 days', 'Last 1 month'].forEach(
      (label) => {
        expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
      }
    );
    expect(screen.getByText(/UTC[+-]\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('applies "Last 1 day" preset with a 24h window ending near now', async () => {
    const { onApply } = setup();
    const before = Date.now();
    await userEvent.click(screen.getByTestId('time-range-preset-select'));
    await userEvent.click(screen.getByRole('option', { name: 'Last 1 day' }));
    const after = Date.now();

    expect(onApply).toHaveBeenCalledTimes(1);
    const [start, end] = onApply.mock.calls[0] as [Date, Date];
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);

    const oneDay = 24 * 60 * 60 * 1000;
    expect(end.getTime() - start.getTime()).toBe(oneDay);
    expect(end.getTime()).toBeGreaterThanOrEqual(before);
    expect(end.getTime()).toBeLessThanOrEqual(after);
  });

  it('applies "Last 7 days" preset with a 7d window', async () => {
    const { onApply } = setup();
    await userEvent.click(screen.getByTestId('time-range-preset-select'));
    await userEvent.click(screen.getByRole('option', { name: 'Last 7 days' }));
    const [start, end] = onApply.mock.calls[0] as [Date, Date];
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('applies "Last 1 month" preset with a 30d window', async () => {
    const { onApply } = setup();
    await userEvent.click(screen.getByTestId('time-range-preset-select'));
    await userEvent.click(screen.getByRole('option', { name: 'Last 1 month' }));
    const [start, end] = onApply.mock.calls[0] as [Date, Date];
    expect(end.getTime() - start.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('shows "Clear" when a range is set and calls onApply(null,null)', async () => {
    const start = new Date(Date.now() - 60 * 60 * 1000);
    const end = new Date();
    const { onApply } = setup(start, end);

    const clear = screen.getByRole('button', { name: /clear time range/i });
    await userEvent.click(clear);

    expect(onApply).toHaveBeenCalledWith(null, null);
  });

  it('hides "Clear" when no range is set', () => {
    setup(null, null);
    expect(
      screen.queryByRole('button', { name: /clear time range/i })
    ).not.toBeInTheDocument();
  });
});
