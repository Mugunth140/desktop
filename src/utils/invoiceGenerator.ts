import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { settingsService } from "../db/settingsService";
import { Invoice, InvoiceItem } from "../types";

export interface InvoiceData {
    invoice: Invoice;
    items: InvoiceItem[];
}

/**
 * Generate a professional invoice PDF matching the garage invoice style
 * Features: Logo on right, store info below, bill-to section, invoice details bar, clean item table
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<string> {
    const settings = await settingsService.getAll();
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // ============================================
    // HEADER: "Invoice" title on left, Logo + store name on right
    // ============================================

    // "Invoice" title - large, on the left
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Invoice", margin, yPos + 10);

    // Store name on the right (logo placeholder)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(settings.store_name || "MotorMods", pageWidth - margin, yPos + 10, { align: "right" });

    yPos += 20;

    // ============================================
    // STORE ADDRESS LINE
    // ============================================
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addressParts: string[] = [];
    if (settings.store_address) addressParts.push(settings.store_address);
    if (settings.store_phone) addressParts.push(settings.store_phone);
    if (settings.store_email) addressParts.push(settings.store_email);

    if (addressParts.length > 0) {
        doc.text(addressParts.join("  |  "), margin, yPos);
        yPos += 6;
    }

    yPos += 8;

    // ============================================
    // BILL TO (left) + INVOICE INFO (right)
    // ============================================

    // Bill To section
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILL TO", margin, yPos);

    yPos += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(data.invoice.customer_name || "Walking Customer", margin, yPos);

    if (data.invoice.customer_phone) {
        yPos += 4;
        doc.text(data.invoice.customer_phone, margin, yPos);
    }

    // Invoice info on the right side
    const invoiceDate = new Date(data.invoice.created_at);
    const formattedDate = invoiceDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
    });

    const rightColX = pageWidth - margin - 40;
    const rightValX = pageWidth - margin;

    let infoY = yPos - 9; // Align with BILL TO

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Invoice No.:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.text(data.invoice.id.slice(-8).toUpperCase(), rightValX, infoY, { align: "right" });

    infoY += 5;
    doc.setTextColor(100, 100, 100);
    doc.text("Issue date:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.text(formattedDate, rightValX, infoY, { align: "right" });

    infoY += 5;
    doc.setTextColor(100, 100, 100);
    doc.text("Payment:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    const paymentMode = (data.invoice.payment_mode || "cash").charAt(0).toUpperCase() +
        (data.invoice.payment_mode || "cash").slice(1);
    doc.text(paymentMode, rightValX, infoY, { align: "right" });

    yPos += 15;

    // ============================================
    // DARK INFO BAR (Invoice No, Issue Date, Total)
    // ============================================

    const barHeight = 12;
    doc.setFillColor(50, 50, 50);
    doc.rect(margin, yPos, pageWidth - 2 * margin, barHeight, "F");

    // Bar content
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    const barY = yPos + 8;
    const col1 = margin + 5;
    const col2 = margin + 50;
    const col3 = margin + 95;
    const col4 = pageWidth - margin - 35;

    doc.text("Invoice No.", col1, barY);
    doc.text("Issue date", col2, barY);
    doc.text("Due date", col3, barY);
    doc.text("Total due (₹)", col4, barY);

    yPos += barHeight + 2;

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - 2 * margin, barHeight, "F");

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const valY = yPos + 8;

    doc.text(data.invoice.id.slice(-8).toUpperCase(), col1, valY);
    doc.text(formattedDate, col2, valY);
    doc.text(formattedDate, col3, valY); // Due date same as issue
    doc.setFont("helvetica", "bold");
    doc.text(`₹ ${data.invoice.total_amount.toLocaleString("en-IN")}`, col4, valY);

    yPos += barHeight + 10;

    // ============================================
    // ITEMS TABLE
    // ============================================

    const tableData = data.items.map((item) => [
        item.product_name || `Product #${item.product_id.slice(-6)}`,
        item.quantity.toString(),
        `₹ ${item.price.toLocaleString("en-IN")}`,
        `₹ ${(item.quantity * item.price).toLocaleString("en-IN")}`,
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["Description", "Quantity", "Unit price (₹)", "Amount (₹)"]],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [100, 100, 100],
            fontStyle: "bold",
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 25, halign: "center" },
            2: { cellWidth: 35, halign: "right" },
            3: { cellWidth: 35, halign: "right" },
        },
        alternateRowStyles: {
            fillColor: [255, 255, 255],
        },
        bodyStyles: {
            textColor: [0, 0, 0],
        },
        theme: "plain",
        tableLineColor: [220, 220, 220],
        tableLineWidth: 0.1,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ============================================
    // TOTAL (right-aligned)
    // ============================================

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = data.invoice.discount_amount || 0;
    const total = data.invoice.total_amount;

    // Draw total line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);

    yPos += 8;

    if (discount > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Subtotal:", pageWidth - margin - 60, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`₹ ${subtotal.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 5;
        doc.setTextColor(100, 100, 100);
        doc.text("Discount:", pageWidth - margin - 60, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`-₹ ${discount.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 8;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Total (₹)", pageWidth - margin - 60, yPos);
    doc.text(`₹ ${total.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    // ============================================
    // FOOTER
    // ============================================

    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

    // Return as base64 data URL
    return doc.output("dataurlstring");
}

/**
 * Save invoice PDF to a file and return the path
 * Used for silent printing
 */
export async function saveInvoicePdf(data: InvoiceData): Promise<string> {
    const settings = await settingsService.getAll();
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // HEADER
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Invoice", margin, yPos + 10);

    doc.setFontSize(16);
    doc.text(settings.store_name || "MotorMods", pageWidth - margin, yPos + 10, { align: "right" });

    yPos += 20;

    // Store address line
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addressParts: string[] = [];
    if (settings.store_address) addressParts.push(settings.store_address);
    if (settings.store_phone) addressParts.push(settings.store_phone);
    if (settings.store_email) addressParts.push(settings.store_email);

    if (addressParts.length > 0) {
        doc.text(addressParts.join("  |  "), margin, yPos);
        yPos += 6;
    }

    yPos += 8;

    // Bill To + Invoice Info
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILL TO", margin, yPos);

    yPos += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(data.invoice.customer_name || "Walking Customer", margin, yPos);

    if (data.invoice.customer_phone) {
        yPos += 4;
        doc.text(data.invoice.customer_phone, margin, yPos);
    }

    const invoiceDate = new Date(data.invoice.created_at);
    const formattedDate = invoiceDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
    });

    const rightColX = pageWidth - margin - 40;
    const rightValX = pageWidth - margin;
    let infoY = yPos - 9;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Invoice No.:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.text(data.invoice.id.slice(-8).toUpperCase(), rightValX, infoY, { align: "right" });

    infoY += 5;
    doc.setTextColor(100, 100, 100);
    doc.text("Issue date:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.text(formattedDate, rightValX, infoY, { align: "right" });

    infoY += 5;
    doc.setTextColor(100, 100, 100);
    doc.text("Payment:", rightColX, infoY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    const paymentMode = (data.invoice.payment_mode || "cash").charAt(0).toUpperCase() +
        (data.invoice.payment_mode || "cash").slice(1);
    doc.text(paymentMode, rightValX, infoY, { align: "right" });

    yPos += 15;

    // Dark info bar
    const barHeight = 12;
    doc.setFillColor(50, 50, 50);
    doc.rect(margin, yPos, pageWidth - 2 * margin, barHeight, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    const barY = yPos + 8;
    const col1 = margin + 5;
    const col2 = margin + 50;
    const col3 = margin + 95;
    const col4 = pageWidth - margin - 35;

    doc.text("Invoice No.", col1, barY);
    doc.text("Issue date", col2, barY);
    doc.text("Due date", col3, barY);
    doc.text("Total due (₹)", col4, barY);

    yPos += barHeight + 2;

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - 2 * margin, barHeight, "F");

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const valY = yPos + 8;

    doc.text(data.invoice.id.slice(-8).toUpperCase(), col1, valY);
    doc.text(formattedDate, col2, valY);
    doc.text(formattedDate, col3, valY);
    doc.setFont("helvetica", "bold");
    doc.text(`₹ ${data.invoice.total_amount.toLocaleString("en-IN")}`, col4, valY);

    yPos += barHeight + 10;

    // Items table
    const tableData = data.items.map((item) => [
        item.product_name || `Product #${item.product_id.slice(-6)}`,
        item.quantity.toString(),
        `₹ ${item.price.toLocaleString("en-IN")}`,
        `₹ ${(item.quantity * item.price).toLocaleString("en-IN")}`,
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["Description", "Quantity", "Unit price (₹)", "Amount (₹)"]],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [255, 255, 255], textColor: [100, 100, 100], fontStyle: "bold", fontSize: 8 },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 25, halign: "center" },
            2: { cellWidth: 35, halign: "right" },
            3: { cellWidth: 35, halign: "right" },
        },
        theme: "plain",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = data.invoice.discount_amount || 0;
    const total = data.invoice.total_amount;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);
    yPos += 8;

    if (discount > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Subtotal:", pageWidth - margin - 60, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`₹ ${subtotal.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 5;
        doc.setTextColor(100, 100, 100);
        doc.text("Discount:", pageWidth - margin - 60, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`-₹ ${discount.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });
        yPos += 8;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Total (₹)", pageWidth - margin - 60, yPos);
    doc.text(`₹ ${total.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

    // Save to temp directory
    const filename = `Invoice_${data.invoice.id.slice(-8).toUpperCase()}_${Date.now()}.pdf`;
    const tempDir = await import("@tauri-apps/api/path").then(p => p.tempDir());
    const filePath = `${tempDir}${filename}`;

    const pdfBlob = doc.output("blob");
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(filePath, uint8Array);

    return filePath;
}
