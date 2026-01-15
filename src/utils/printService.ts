import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../db/runtime";

/**
 * Print result with success status and optional error message
 */
export interface PrintResult {
    success: boolean;
    error?: string;
}

/**
 * Print a PDF silently using SumatraPDF (Windows only).
 * @param pdfPath Absolute path to the PDF file
 * @param printerName Optional printer name (uses default if not specified)
 */
export async function printPdfSilent(pdfPath: string, printerName?: string): Promise<void> {
    if (!isTauriRuntime()) {
        console.warn("Silent printing is only available in the desktop app.");
        throw new Error("Silent printing requires the desktop application.");
    }

    await invoke("print_pdf_silent", {
        pdfPath,
        printerName: printerName ?? null,
    });
}

/**
 * Try to print a PDF silently. Returns success status instead of throwing.
 * Use this when you want the operation to continue even if printing fails.
 * @param pdfPath Absolute path to the PDF file
 * @param printerName Optional printer name (uses default if not specified)
 */
export async function tryPrintPdfSilent(pdfPath: string, printerName?: string): Promise<PrintResult> {
    if (!isTauriRuntime()) {
        return { success: false, error: "Silent printing requires the desktop application." };
    }

    try {
        await invoke("print_pdf_silent", {
            pdfPath,
            printerName: printerName ?? null,
        });
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("Silent printing failed:", errorMessage);
        return { success: false, error: errorMessage };
    }
}

/**
 * Check if printing is available (SumatraPDF is set up)
 */
export async function isPrintingAvailable(): Promise<boolean> {
    if (!isTauriRuntime()) {
        return false;
    }

    try {
        // We could add a specific check command, but for now just return true if in Tauri
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate invoice PDF content and return as base64 for saving.
 * This can be used before calling printPdfSilent.
 */
export function generateInvoicePdfContent(
    invoiceData: {
        invoiceNumber: string;
        customerName: string;
        customerPhone?: string;
        items: Array<{ name: string; quantity: number; price: number; total: number }>;
        subtotal: number;
        tax: number;
        total: number;
        date: string;
    }
): string {
    // This returns a simple text representation for now
    // Can be enhanced with jsPDF for actual PDF generation
    const lines = [
        "================================",
        "         MOTORMODS",
        "      Performance Billing",
        "================================",
        "",
        `Invoice: ${invoiceData.invoiceNumber}`,
        `Date: ${invoiceData.date}`,
        `Customer: ${invoiceData.customerName}`,
        invoiceData.customerPhone ? `Phone: ${invoiceData.customerPhone}` : "",
        "",
        "--------------------------------",
        "Items:",
        "--------------------------------",
        ...invoiceData.items.map(
            (item) => `${item.name}\n  ${item.quantity} x ₹${item.price} = ₹${item.total}`
        ),
        "--------------------------------",
        `Subtotal: ₹${invoiceData.subtotal}`,
        invoiceData.tax > 0 ? `Tax: ₹${invoiceData.tax}` : "",
        `TOTAL: ₹${invoiceData.total}`,
        "================================",
        "Thank you for your business!",
        "================================",
    ].filter(Boolean);

    return lines.join("\n");
}
