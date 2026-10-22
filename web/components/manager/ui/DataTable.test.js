import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import DataTable from './DataTable';

const columns = [
  { key: 'name', header: 'Account', sortable: true, mobile: 'primary' },
  { key: 'revenue', header: 'Revenue', align: 'right', sortable: true, mobile: 'meta' },
];
const rows = [
  { id: '1', name: 'Bravo', revenue: 200 },
  { id: '2', name: 'Alpha', revenue: 500 },
  { id: '3', name: 'Charlie', revenue: 100 },
];

const tableNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('DataTable', () => {
  it('keeps the given row order until a column is sorted', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(tableNames()).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('sorts by a sortable column and toggles direction on second click', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const header = within(screen.getByRole('table')).getByRole('button', { name: /Revenue/ });
    fireEvent.click(header);
    expect(tableNames()).toEqual(['Alpha', 'Bravo', 'Charlie']); // numbers sort high → low first
    fireEvent.click(header);
    expect(tableNames()).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts text columns A → Z first', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /Account/ }));
    expect(tableNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('calls onRowClick with the row', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(within(screen.getByRole('table')).getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('renders the empty node when rows is empty', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
