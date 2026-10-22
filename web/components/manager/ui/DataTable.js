'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';

/**
 * Sortable data table. ≥ 768px renders a table; below it renders a stacked
 * list built from each column's `mobile` role:
 *   primary   — main line (left)
 *   secondary — second line under primary
 *   meta      — right-aligned value
 *   hidden    — not shown on phones
 *
 * columns: [{ key, header, align?, sortable?, sortValue?(row), render?(row), mobile?, className? }]
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSort = null,
  empty = null,
  className = '',
}) {
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
      // Numbers read best high → low first; text A → Z.
      return { key: col.key, dir: typeof sample === 'number' ? 'desc' : 'asc' };
    });
  };

  if (!rows.length) return empty;

  const cellAlign = (col) => (col.align === 'right' ? 'text-right' : 'text-left');
  const render = (col, row) => (col.render ? col.render(row) : row[col.key]);
  const pick = (role) => columns.filter((c) => c.mobile === role);
  const interactive = Boolean(onRowClick);
  const activate = (row) => (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    onRowClick?.(row);
  };

  return (
    <div className={className}>
      {/* Table — tablet and desktop */}
      <table className="hidden md:table w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`${cellAlign(col)} px-4 first:pl-6 last:pr-6 py-3 m-fs-11 font-semibold m-muted border-b border-[var(--m-border)] whitespace-nowrap ${col.className || ''}`}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className={`inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {col.header}
                    {sort?.key === col.key &&
                      (sort.dir === 'asc'
                        ? <ArrowUp size={12} strokeWidth={1.5} aria-hidden="true" />
                        : <ArrowDown size={12} strokeWidth={1.5} aria-hidden="true" />)}
                  </button>
                ) : (
                  col.header
                )}
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
              className={`m-row ${interactive ? 'm-row-interactive' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${cellAlign(col)} px-4 first:pl-6 last:pr-6 py-3.5 border-b border-[var(--m-border)] ${col.align === 'right' ? 'm-num' : ''} ${col.className || ''}`}
                >
                  {render(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stacked list — phones */}
      <ul className="md:hidden m-divide">
        {sorted.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? activate(row) : undefined}
              onKeyDown={interactive ? activate(row) : undefined}
              className={`flex items-center gap-3 px-4 py-3.5 min-h-[64px] ${interactive ? 'm-row-interactive' : ''}`}
            >
              <div className="min-w-0 flex-1">
                {pick('primary').map((col) => (
                  <div key={col.key} className="truncate font-semibold">{render(col, row)}</div>
                ))}
                {pick('secondary').map((col) => (
                  <div key={col.key} className="truncate m-fs-12 m-muted">{render(col, row)}</div>
                ))}
              </div>
              {pick('meta').map((col) => (
                <div key={col.key} className="shrink-0 text-right m-num font-semibold">{render(col, row)}</div>
              ))}
              {interactive && <ChevronRight size={16} strokeWidth={1.5} className="m-faint shrink-0" aria-hidden="true" />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
