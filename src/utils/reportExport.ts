import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type TableColumn = { key: string; label: string };

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

export const exportTableToPdf = async (opts: {
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

  if (isTauri()) {
    try {
      // Use Tauri file dialog to save
      const filePath = await save({
        defaultPath: opts.filename,
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (filePath) {
        // Get PDF as array buffer and write using Tauri FS
        const pdfArrayBuffer = doc.output("arraybuffer");
        await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
      }
    } catch (error) {
      console.error("Failed to save PDF:", error);
      // Fallback to browser download
      doc.save(opts.filename);
    }
  } else {
    // Browser fallback
    doc.save(opts.filename);
  }
};

export const exportTableToCsv = async (opts: {
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

  if (isTauri()) {
    try {
      // Use Tauri file dialog to save
      const filePath = await save({
        defaultPath: opts.filename,
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, csv);
      }
    } catch (error) {
      console.error("Failed to save CSV:", error);
      // Fallback to browser download
      downloadAsBrowserBlob(csv, opts.filename, "text/csv;charset=utf-8");
    }
  } else {
    // Browser fallback
    downloadAsBrowserBlob(csv, opts.filename, "text/csv;charset=utf-8");
  }
};

// Helper for browser blob downloads
const downloadAsBrowserBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
