import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type TableColumn = { key: string; label: string };

export const exportTableToPdf = (opts: {
  title: string;
  dateRangeText?: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, string | number>;
  filename: string;
}) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(opts.title, 40, 40);

  if (opts.dateRangeText) {
    doc.setFontSize(10);
    doc.text(opts.dateRangeText, 40, 58);
  }

  const head = [opts.columns.map((c) => c.label)];
  const body = opts.rows.map((r) => opts.columns.map((c) => String(r[c.key] ?? "")));

  autoTable(doc, {
    startY: opts.dateRangeText ? 75 : 60,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
  });

  if (opts.totals) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 75;
    doc.setFontSize(10);
    doc.text(
      `Totals: ${Object.entries(opts.totals)
        .map(([k, v]) => `${k}: ${v}`)
        .join("   ")}`,
      40,
      finalY + 20
    );
  }

  doc.save(opts.filename);
};

export const exportTableToCsv = (opts: {
  columns: TableColumn[];
  rows: Record<string, any>[];
  filename: string;
}) => {
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = opts.columns.map((c) => escape(c.label)).join(",");
  const lines = opts.rows.map((r) => opts.columns.map((c) => escape(r[c.key])).join(","));
  const csv = [header, ...lines].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(url);
};
