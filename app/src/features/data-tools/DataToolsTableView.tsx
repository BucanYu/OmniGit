import React, { useMemo, useState } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import { Table2, ArrowUpDown } from 'lucide-react';
import { useTranslation } from '../../locales';

export const DataToolsTableView: React.FC = () => {
  const { t } = useTranslation();
  const { parsedData } = useDataToolsStore();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Locate the primary array of objects using breadth-first search
  const tableData: Record<string, any>[] = useMemo(() => {
    if (!parsedData || typeof parsedData !== 'object') return [];
    if (Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === 'object') {
      return parsedData;
    }
    const queue: any[] = [parsedData];
    let visited = 0;
    while (queue.length > 0 && visited < 50) {
      const current = queue.shift();
      visited++;
      if (Array.isArray(current) && current.length > 0 && typeof current[0] === 'object' && current[0] !== null) {
        return current;
      }
      if (current && typeof current === 'object') {
        for (const val of Object.values(current)) {
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            return val;
          }
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            queue.push(val);
          }
        }
      }
    }
    return [];
  }, [parsedData]);

  // Extract unique column names
  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    const colSet = new Set<string>();
    for (const item of tableData.slice(0, 100)) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((k) => colSet.add(k));
      }
    }
    return Array.from(colSet);
  }, [tableData]);

  const sortedData = useMemo(() => {
    if (!sortKey) return tableData;
    return [...tableData].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [tableData, sortKey, sortAsc]);

  const handleHeaderClick = (col: string) => {
    if (sortKey === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(col);
      setSortAsc(true);
    }
  };

  if (tableData.length === 0 || columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-muted select-none bg-theme-panel/40">
        <Table2 className="w-10 h-10 text-theme-muted/40 mb-3" />
        <p className="text-xs font-medium">{t.dataTools.noTableData}</p>
        <p className="text-[11px] text-theme-dim mt-1 max-w-sm">
          {t.dataTools.noTableDataDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-app select-none">
      {/* Table Stats Bar */}
      <div className="px-3 py-1.5 border-b border-theme-border bg-theme-sidebar/60 flex items-center justify-between text-xs text-theme-muted shrink-0">
        <span className="font-mono text-[11px]">
          {t.dataTools.tableRowsCount(tableData.length)} · {columns.length} Columns
        </span>
      </div>

      {/* Table Scroll Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-theme-sidebar border-b border-theme-border z-10">
            <tr>
              <th className="py-2 px-3 text-[10px] font-semibold text-theme-dim uppercase tracking-wider w-12 text-center border-r border-theme-border/50">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleHeaderClick(col)}
                  className="py-2 px-3 text-[11px] font-semibold text-theme-main hover:bg-theme-hover/60 transition-colors cursor-pointer border-r border-theme-border/50 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col}</span>
                    <ArrowUpDown className="w-3 h-3 text-theme-dim" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/40">
            {sortedData.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-theme-hover/40 transition-colors font-sans text-xs"
              >
                <td className="py-2 px-3 text-center text-theme-dim font-mono text-[10px] border-r border-theme-border/40 bg-theme-sidebar/30">
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  const val = row[col];
                  const isObj = typeof val === 'object' && val !== null;
                  const display = isObj ? JSON.stringify(val) : String(val ?? '');

                  return (
                    <td
                      key={col}
                      className="py-2 px-3 border-r border-theme-border/40 max-w-xs truncate"
                      title={display}
                    >
                      {val === null || val === undefined ? (
                        <span className="text-theme-dim italic">null</span>
                      ) : typeof val === 'boolean' ? (
                        <span className="text-pink-600 dark:text-pink-400 font-semibold font-mono text-[11px]">
                          {String(val)}
                        </span>
                      ) : typeof val === 'number' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                          {val}
                        </span>
                      ) : isObj ? (
                        <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px] bg-purple-500/10 px-1 py-0.5 rounded">
                          {Array.isArray(val) ? `[${val.length}]` : '{...}'}
                        </span>
                      ) : (
                        <span className="text-theme-main">{display}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
