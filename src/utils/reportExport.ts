import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { settingsService } from "../db/settingsService";

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
  const settings = await settingsService.getAll();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  let yPos = 30;

  // ============================================
  // BRANDING HEADER
  // ============================================

  // Store Name (large, left-aligned)
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(settings.store_name || "MotorMods", 40, yPos);

  // Generated date (right-aligned)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 40, yPos, { align: "right" });

  yPos += 18;

  // Store contact info (below store name)
  doc.setFontSize(9);
  const contactParts: string[] = [];
  if (settings.store_phone) contactParts.push(settings.store_phone);
  if (settings.store_email) contactParts.push(settings.store_email);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  •  "), 40, yPos);
    yPos += 12;
  }

  if (settings.store_address) {
    doc.text(settings.store_address, 40, yPos);
    yPos += 12;
  }

  // Divider line
  yPos += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(40, yPos, pageWidth - 40, yPos);
  yPos += 20;

  // ============================================
  // REPORT TITLE & DATE RANGE
  // ============================================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 40, yPos);
  yPos += 18;

  if (opts.dateRangeText) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(opts.dateRangeText, 40, yPos);
    yPos += 18;
  }

  // ============================================
  // TABLE
  // ============================================
  const head = [opts.columns.map((c) => c.label)];
  const body = opts.rows.map((r) => opts.columns.map((c) => String(r[c.key] ?? "")));

  autoTable(doc, {
    startY: yPos,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
  });

  // ============================================
  // TOTALS
  // ============================================
  if (opts.totals) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? yPos;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Totals: ${Object.entries(opts.totals)
        .map(([k, v]) => `${k}: ${v}`)
        .join("   ")}`,
      40,
      finalY + 20
    );
  }

  // ============================================
  // FOOTER
  // ============================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}  •  ${settings.store_name || "MotorMods"}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }

  // ============================================
  // SAVE
  // ============================================
  if (isTauri()) {
    try {
      const filePath = await save({
        defaultPath: opts.filename,
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (filePath) {
        const pdfArrayBuffer = doc.output("arraybuffer");
        await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
      }
    } catch (error) {
      console.error("Failed to save PDF:", error);
      doc.save(opts.filename);
    }
  } else {
    doc.save(opts.filename);
  }
};

export const exportTableToCsv = async (opts: {
  columns: TableColumn[];
  rows: Record<string, any>[];
  filename: string;
}) => {
  const settings = await settingsService.getAll();

  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Add branding header rows
  const brandingRows = [
    `# ${settings.store_name || "MotorMods"} - Report Export`,
    `# Generated: ${new Date().toLocaleString()}`,
    settings.store_phone ? `# Contact: ${settings.store_phone}` : null,
    settings.store_email ? `# Email: ${settings.store_email}` : null,
    `#`,
  ].filter(Boolean).join("\n");

  const header = opts.columns.map((c) => escape(c.label)).join(",");
  const lines = opts.rows.map((r) => opts.columns.map((c) => escape(r[c.key])).join(","));
  const csv = [brandingRows, header, ...lines].join("\n");

  if (isTauri()) {
    try {
      const filePath = await save({
        defaultPath: opts.filename,
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, csv);
      }
    } catch (error) {
      console.error("Failed to save CSV:", error);
      downloadAsBrowserBlob(csv, opts.filename, "text/csv;charset=utf-8");
    }
  } else {
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
