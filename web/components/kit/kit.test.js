import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { toneOf } from './StatusPill';
import StatusPill from './StatusPill';
import DataTable from './DataTable';
import PillTabs from './PillTabs';
import TrendChart from './TrendChart';

vi.mock('next/dynamic', () => ({ default: () => function ChartStub() { return <div data-testid="chart" />; } }));

describe('StatusPill', () => {
  it.each([
    ['delivered', 'good'], ['paid', 'good'], ['pending', 'warn'], ['in_transit', 'warn'],
    ['cancelled', 'bad'], ['failed', 'bad'], ['something_new', 'neutral'], [undefined, 'neutral'],
  ])('%s → %s', (status, tone) => expect(toneOf(status)).toBe(tone));

  it('humanises the label', () => {
    render(<StatusPill status="out_for_delivery" />);
    expect(screen.getByText('out for delivery')).toBeTruthy();
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name', sortable: true, mobile: 'primary' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, mobile: 'meta' },
  ];
  const rows = [{ id: 1, name: 'B', amount: 5 }, { id: 2, name: 'A', amount: 50 }];

  it('renders the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('sorts numbers high → low on first click', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(within(container.querySelector('table')).getByText('Amount'));
    const firstCell = container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[0];
    expect(firstCell.textContent).toBe('A');
  });

  it('calls onRowClick from the keyboard', () => {
    const onRowClick = vi.fn();
    const { container } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.keyDown(container.querySelector('tbody tr'), { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});

describe('PillTabs', () => {
  it('marks the active tab and reports changes', () => {
    const onChange = vi.fn();
    render(<PillTabs value="a" onChange={onChange} tabs={[{ value: 'a', label: 'All', count: 3 }, { value: 'b', label: 'Open' }]} />);
    expect(screen.getByRole('tab', { name: /All/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Open' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('TrendChart', () => {
  it('shows the empty state (and never loads the chart library) when every value is zero', () => {
    render(<TrendChart data={[{ label: 'Jan', value: 0 }]} emptyTitle="No sales yet" />);
    expect(screen.getByText('No sales yet')).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
  });

  it('renders the chart when there is data', () => {
    render(<TrendChart data={[{ label: 'Jan', value: 10 }]} />);
    expect(screen.getByTestId('chart')).toBeTruthy();
  });
});
