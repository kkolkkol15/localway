import { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const PAGE_SIZE = 5;

export function DataTable({ columns, rows, searchPlaceholder = '검색', filters, actions, onRowClick }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? '');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const searched = lower
      ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(lower))
      : rows;
    return [...searched].sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko');
    });
  }, [rows, query, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function sort(column) {
    if (!column.sortable) return;
    setSortKey(column.key);
    setSortDir(sortKey === column.key && sortDir === 'asc' ? 'desc' : 'asc');
  }

  return (
    <div className="table-shell">
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input value={query} placeholder={searchPlaceholder} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        {filters}
        {actions}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <button className="th-button" type="button" onClick={() => sort(column)}>
                    {column.label}
                    {column.sortable && <ArrowDownUp size={14} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => (
              <tr key={row.id} onClick={() => onRowClick?.(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pagination">
        <span>{filtered.length}개 중 {currentRows.length}개 표시</span>
        <div>
          <button className="icon-button" type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft size={18} />
          </button>
          <b>{page} / {pages}</b>
          <button className="icon-button" type="button" disabled={page === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
