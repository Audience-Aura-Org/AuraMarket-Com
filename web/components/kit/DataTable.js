'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';

/**
 * Sortable table ≥ 768px; stacked rows on phones (no horizontal scrolling).
 * Each column's `mobile` role places it on phones:
 *   primary — main line · secondary — under it · meta — right side · hidden
 *
 * columns: [{ key, header, align?, sortable?, sortValue?(row), render?(row), mobile?, className? }]
 * Rows are sorted in memory; pass a page of rows (keep lists paginated).
 */
export default function DataTable({ columns, rows, rowKey, onRowClick, initialSort = null, empty = null, className = '' }) {
  const [sort, setSort] = useState(initialSort);

  const valueOf = (col, row) => (col.sortValue ? col.sortValue(row) : row[col.key]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = valueOf(col, a);
      const vb = valueOf(col, b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, columns]);

  const toggleSort = (col) => {
    setSort((prev) => {
      if (prev?.key === col.key) return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      const sample = rows.map((r) => valueOf(col, r)).find((v) => v != null);
      return { key: col.key, dir: typeof sample === 'number' ? 'desc' : 'asc' }; // numbers high→low, text A→Z
    });
  };

  if (!rows.length) return empty;

  const align = (col) => (col.align === 'right' ? 'text-right' : 'text-left');
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key]);
  const pick = (role) => columns.filter((c) => c.mobile === role);
  const interactive = Boolean(onRowClick);
  const activate = (row) => (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    onRowClick?.(row);
  };

  return (
    <div className={className}>
      <table className="hidden w-full border-separate border-spacing-0 md:table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`${align(col)} whitespace-nowrap border-b border-[var(--glass-border)] px-4 py-3 text-[10px] lg:text-[11px] font-semibold text-[var(--text-secondary)] first:pl-6 last:pr-6 ${col.className || ''}`}
              >
                {col.sortable ? (
                  <button type="button" onClick={() => toggleSort(col)}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-[var(--accent)] ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.header}
                    {sort?.key === col.key && (sort.dir === 'asc'
                      ? <ArrowUp size={12} aria-hidden="true" />
                      : <ArrowDown size={12} aria-hidden="true" />)}
                  </button>
                ) : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={interactive ? activate(row) : undefined}
              onKeyDown={interactive ? activate(row) : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={interactive ? 'cursor-pointer transition-colors hover:bg-[var(--accent)]/[0.04]' : ''}
            >
              {columns.map((col) => (
                <td key={col.key}
                  className={`${align(col)} border-b border-[var(--glass-border)] px-4 py-3.5 text-[11px] lg:text-[13px] text-[var(--text-primary)] first:pl-6 last:pr-6 ${col.align === 'right' ? 'tabular-nums' : ''} ${col.className || ''}`}>
                  {cell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-[var(--glass-border)] md:hidden">
        {sorted.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? activate(row) : undefined}
              onKeyDown={interactive ? activate(row) : undefined}
              className={`flex min-h-[64px] items-center gap-3 px-4 py-3.5 ${interactive ? 'active:bg-[var(--accent)]/[0.06]' : ''}`}
            >
              <div className="min-w-0 flex-1">
                {pick('primary').map((col) => <div key={col.key} className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{cell(col, row)}</div>)}
                {pick('secondary').map((col) => <div key={col.key} className="truncate text-[11px] text-[var(--text-secondary)]">{cell(col, row)}</div>)}
              </div>
              {pick('meta').map((col) => <div key={col.key} className="shrink-0 text-right text-[12px] font-semibold tabular-nums">{cell(col, row)}</div>)}
              {interactive && <ChevronRight size={16} className="shrink-0 text-[var(--text-secondary)] opacity-60" aria-hidden="true" />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
