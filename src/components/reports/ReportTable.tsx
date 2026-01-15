import React from "react";
import { Card } from "../ui";

export type ReportColumn<RowT> = {
  key: keyof RowT;
  label: string;
  align?: "left" | "right" | "center";
};

export const ReportTable = <RowT extends Record<string, any>>({
  title,
  columns,
  rows,
  totalsRow,
}: {
  title?: string;
  columns: ReportColumn<RowT>[];
  rows: RowT[];
  totalsRow?: Partial<Record<keyof RowT, string | number | React.ReactNode>>;
}) => {
  // Helper to render cell content - handles both primitives and React elements
  const renderCellContent = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return "";
    if (React.isValidElement(value)) return value;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <Card padding="none" className="overflow-hidden flex-1 flex flex-col min-h-0">
      {title && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
        </div>
      )}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  className={
                    "p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider " +
                    (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")
                  }
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-400">
                  No data available. Click "Generate" to load report data.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((c) => (
                    <td
                      key={String(c.key)}
                      className={
                        "p-4 text-sm text-slate-700 " +
                        (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")
                      }
                    >
                      {renderCellContent(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totalsRow && rows.length > 0 && (
            <tfoot className="bg-white sticky bottom-0">
              <tr className="border-t border-slate-200">
                {columns.map((c) => (
                  <td
                    key={String(c.key)}
                    className={
                      "p-4 text-sm font-semibold text-slate-900 " +
                      (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")
                    }
                  >
                    {totalsRow[c.key] != null ? renderCellContent(totalsRow[c.key]) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
};
