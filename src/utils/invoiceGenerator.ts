import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { settingsService } from "../db/settingsService";
import { Invoice, InvoiceItem } from "../types";

export interface InvoiceData {
    invoice: Invoice;
    items: InvoiceItem[];
}

/**
 * Generate a modern black & white invoice PDF
 * Features: Store logo, store details, customer info, clean item table
 * No GSTIN or tax-related fields
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
    // HEADER: Logo + Store Details
    // ============================================

    // Try to load and add logo
    try {
        // Logo on the left
        doc.addImage("/logo.png", "PNG", margin, yPos, 25, 25);
    } catch {
        // If logo fails, just skip it
    }

    // Store name and details on the right
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(settings.store_name || "MotorMods", pageWidth - margin, yPos + 8, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    let contactY = yPos + 14;
    if (settings.store_phone) {
        doc.text(settings.store_phone, pageWidth - margin, contactY, { align: "right" });
        contactY += 4;
    }
    if (settings.store_email) {
        doc.text(settings.store_email, pageWidth - margin, contactY, { align: "right" });
        contactY += 4;
    }
    if (settings.store_address) {
        const addressLines = doc.splitTextToSize(settings.store_address, 60);
        addressLines.forEach((line: string) => {
            doc.text(line, pageWidth - margin, contactY, { align: "right" });
            contactY += 4;
        });
    }

    yPos = Math.max(yPos + 30, contactY + 5);

    // ============================================
    // INVOICE TITLE & NUMBER
    // ============================================

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", margin, yPos);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`#${data.invoice.id.slice(-8).toUpperCase()}`, pageWidth - margin, yPos, { align: "right" });

    yPos += 8;

    // Date
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const invoiceDate = new Date(data.invoice.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    doc.text(`Date: ${invoiceDate}`, margin, yPos);

    yPos += 10;

    // ============================================
    // CUSTOMER SECTION
    // ============================================

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 2, 2, "F");

    yPos += 6;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("BILL TO", margin + 5, yPos);

    yPos += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(data.invoice.customer_name || "Walking Customer", margin + 5, yPos);

    if (data.invoice.customer_phone) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(data.invoice.customer_phone, margin + 5, yPos + 5);
    }

    yPos += 18;

    // ============================================
    // ITEMS TABLE
    // ============================================

    const tableData = data.items.map((item, index) => [
        (index + 1).toString(),
        item.product_name || `Product #${item.product_id.slice(-6)}`,
        item.quantity.toString(),
        `₹${item.price.toLocaleString("en-IN")}`,
        `₹${(item.quantity * item.price).toLocaleString("en-IN")}`,
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["#", "Description", "Qty", "Rate", "Amount"]],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [230, 230, 230],
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 15, halign: "center" },
            3: { cellWidth: 25, halign: "right" },
            4: { cellWidth: 30, halign: "right" },
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250],
        },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ============================================
    // TOTALS
    // ============================================

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = data.invoice.discount_amount || 0;
    const total = data.invoice.total_amount;

    const totalsX = pageWidth - margin - 60;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Subtotal:", totalsX, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`₹${subtotal.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    if (discount > 0) {
        yPos += 6;
        doc.setTextColor(100, 100, 100);
        doc.text("Discount:", totalsX, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`-₹${discount.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });
    }

    yPos += 8;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", totalsX, yPos);
    doc.text(`₹${total.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    // ============================================
    // PAYMENT MODE
    // ============================================

    if (data.invoice.payment_mode) {
        yPos += 10;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const modeLabel = data.invoice.payment_mode.charAt(0).toUpperCase() + data.invoice.payment_mode.slice(1);
        doc.text(`Paid via ${modeLabel}`, pageWidth - margin, yPos, { align: "right" });
    }

    // ============================================
    // FOOTER
    // ============================================

    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

    doc.setFontSize(7);
    doc.text("This is a computer-generated invoice.", pageWidth / 2, footerY + 5, { align: "center" });

    // Return as base64 data URL
    return doc.output("dataurlstring");
}

/**
 * Save invoice PDF to a file and return the path
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

    // HEADER: Logo + Store Details
    try {
        doc.addImage("/logo.png", "PNG", margin, yPos, 25, 25);
    } catch {
        // If logo fails, just skip it
    }

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(settings.store_name || "MotorMods", pageWidth - margin, yPos + 8, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    let contactY = yPos + 14;
    if (settings.store_phone) {
        doc.text(settings.store_phone, pageWidth - margin, contactY, { align: "right" });
        contactY += 4;
    }
    if (settings.store_email) {
        doc.text(settings.store_email, pageWidth - margin, contactY, { align: "right" });
        contactY += 4;
    }
    if (settings.store_address) {
        const addressLines = doc.splitTextToSize(settings.store_address, 60);
        addressLines.forEach((line: string) => {
            doc.text(line, pageWidth - margin, contactY, { align: "right" });
            contactY += 4;
        });
    }

    yPos = Math.max(yPos + 30, contactY + 5);

    // INVOICE TITLE & NUMBER
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", margin, yPos);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`#${data.invoice.id.slice(-8).toUpperCase()}`, pageWidth - margin, yPos, { align: "right" });

    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const invoiceDate = new Date(data.invoice.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    doc.text(`Date: ${invoiceDate}`, margin, yPos);
    yPos += 10;

    // CUSTOMER SECTION
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 2, 2, "F");
    yPos += 6;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("BILL TO", margin + 5, yPos);
    yPos += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(data.invoice.customer_name || "Walking Customer", margin + 5, yPos);
    if (data.invoice.customer_phone) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(data.invoice.customer_phone, margin + 5, yPos + 5);
    }
    yPos += 18;

    // ITEMS TABLE
    const tableData = data.items.map((item, index) => [
        (index + 1).toString(),
        item.product_name || `Product #${item.product_id.slice(-6)}`,
        item.quantity.toString(),
        `₹${item.price.toLocaleString("en-IN")}`,
        `₹${(item.quantity * item.price).toLocaleString("en-IN")}`,
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["#", "Description", "Qty", "Rate", "Amount"]],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.1 },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 15, halign: "center" },
            3: { cellWidth: 25, halign: "right" },
            4: { cellWidth: 30, halign: "right" },
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // TOTALS
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = data.invoice.discount_amount || 0;
    const total = data.invoice.total_amount;
    const totalsX = pageWidth - margin - 60;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Subtotal:", totalsX, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`₹${subtotal.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    if (discount > 0) {
        yPos += 6;
        doc.setTextColor(100, 100, 100);
        doc.text("Discount:", totalsX, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(`-₹${discount.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });
    }

    yPos += 8;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", totalsX, yPos);
    doc.text(`₹${total.toLocaleString("en-IN")}`, pageWidth - margin, yPos, { align: "right" });

    if (data.invoice.payment_mode) {
        yPos += 10;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const modeLabel = data.invoice.payment_mode.charAt(0).toUpperCase() + data.invoice.payment_mode.slice(1);
        doc.text(`Paid via ${modeLabel}`, pageWidth - margin, yPos, { align: "right" });
    }

    // FOOTER
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });
    doc.setFontSize(7);
    doc.text("This is a computer-generated invoice.", pageWidth / 2, footerY + 5, { align: "center" });

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
