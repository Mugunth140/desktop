import { v4 as uuidv4 } from "uuid";
import { ReturnItem, ReturnReason, SalesReturn, SalesReturnWithItems } from "../types";
import { getDb } from "./index";
import { productService } from "./productService";
import { isTauriRuntime } from "./runtime";
import { stockAdjustmentService } from "./stockAdjustmentService";

const RETURNS_KEY = "motormods_sales_returns_v1";
const RETURN_ITEMS_KEY = "motormods_return_items_v1";

interface CreateReturnData {
    invoiceId: string;
    reason: ReturnReason;
    notes: string | null;
    items: Array<{
        productId: string;
        quantity: number;
        rate: number;
    }>;
    createdBy?: string;
}

const loadReturns = (): SalesReturn[] => {
    try {
        const raw = localStorage.getItem(RETURNS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SalesReturn[];
    } catch {
        return [];
    }
};

const saveReturns = (returns: SalesReturn[]) => {
    localStorage.setItem(RETURNS_KEY, JSON.stringify(returns));
};

const loadReturnItems = (): ReturnItem[] => {
    try {
        const raw = localStorage.getItem(RETURN_ITEMS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ReturnItem[];
    } catch {
        return [];
    }
};

const saveReturnItems = (items: ReturnItem[]) => {
    localStorage.setItem(RETURN_ITEMS_KEY, JSON.stringify(items));
};

export const returnsService = {
    /**
     * Generate a unique return number (RET-YYYYMMDD-XXX)
     */
    async generateReturnNumber(): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `RET-${dateStr}`;

        if (!isTauriRuntime()) {
            const returns = loadReturns();
            const todayReturns = returns.filter(r => r.return_no.startsWith(prefix));
            const nextNum = todayReturns.length + 1;
            return `${prefix}-${String(nextNum).padStart(3, '0')}`;
        }

        const db = await getDb();
        const result = await db.select<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM sales_returns WHERE return_no LIKE $1",
            [`${prefix}%`]
        );
        const nextNum = (result[0]?.count ?? 0) + 1;
        return `${prefix}-${String(nextNum).padStart(3, '0')}`;
    },

    /**
     * Create a new sales return with stock reversal
     */
    async create(data: CreateReturnData): Promise<SalesReturn> {
        const returnNo = await this.generateReturnNumber();
        const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

        const salesReturn: SalesReturn = {
            id: uuidv4(),
            return_no: returnNo,
            invoice_id: data.invoiceId,
            return_date: new Date().toISOString(),
            reason: data.reason,
            total_amount: totalAmount,
            notes: data.notes,
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const returnItems: ReturnItem[] = data.items.map(item => ({
            id: uuidv4(),
            return_id: salesReturn.id,
            product_id: item.productId,
            quantity: item.quantity,
            rate: item.rate,
            line_total: item.quantity * item.rate,
        }));

        if (!isTauriRuntime()) {
            // Save return
            const returns = loadReturns();
            returns.push(salesReturn);
            saveReturns(returns);

            // Save return items
            const allItems = loadReturnItems();
            allItems.push(...returnItems);
            saveReturnItems(allItems);

            // Increase stock for each returned item
            for (const item of data.items) {
                await productService.updateQuantity(item.productId, item.quantity);
                await stockAdjustmentService.create(
                    item.productId,
                    'return',
                    item.quantity,
                    `Return ${returnNo}: ${data.reason}`,
                    data.createdBy ?? 'system'
                );
            }

            return salesReturn;
        }

        const db = await getDb();

        // Insert return header
        await db.execute(
            `INSERT INTO sales_returns (id, return_no, invoice_id, return_date, reason, total_amount, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                salesReturn.id,
                salesReturn.return_no,
                salesReturn.invoice_id,
                salesReturn.return_date,
                salesReturn.reason,
                salesReturn.total_amount,
                salesReturn.notes,
                salesReturn.status,
                salesReturn.created_at,
                salesReturn.updated_at,
            ]
        );

        // Insert return items and reverse stock
        for (const item of returnItems) {
            await db.execute(
                `INSERT INTO return_items (id, return_id, product_id, quantity, rate, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [item.id, item.return_id, item.product_id, item.quantity, item.rate, item.line_total]
            );

            // Increase stock
            await productService.updateQuantity(item.product_id, item.quantity);

            // Log adjustment
            await stockAdjustmentService.create(
                item.product_id,
                'return',
                item.quantity,
                `Return ${returnNo}: ${data.reason}`,
                data.createdBy ?? 'system'
            );
        }

        return salesReturn;
    },

    /**
     * Get all sales returns with optional filters
     */
    async getAll(options: {
        limit?: number;
        offset?: number;
        fromDate?: string;
        toDate?: string;
    } = {}): Promise<SalesReturn[]> {
        const { limit = 50, offset = 0, fromDate, toDate } = options;

        if (!isTauriRuntime()) {
            let returns = loadReturns();

            if (fromDate) {
                returns = returns.filter(r => r.return_date >= fromDate);
            }
            if (toDate) {
                returns = returns.filter(r => r.return_date <= toDate);
            }

            return returns
                .sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime())
                .slice(offset, offset + limit);
        }

        const db = await getDb();
        const conditions: string[] = [];
        const args: unknown[] = [];
        let argIdx = 1;

        if (fromDate) {
            conditions.push(`date(sr.return_date) >= date($${argIdx++})`);
            args.push(fromDate);
        }
        if (toDate) {
            conditions.push(`date(sr.return_date) <= date($${argIdx++})`);
            args.push(toDate);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return await db.select<SalesReturn[]>(
            `SELECT sr.*, i.customer_name, i.total_amount as original_invoice_total
       FROM sales_returns sr
       LEFT JOIN invoices i ON sr.invoice_id = i.id
       ${whereSql}
       ORDER BY sr.return_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
            args
        );
    },

    /**
     * Get a single return by ID with items
     */
    async getById(id: string): Promise<SalesReturnWithItems | null> {
        if (!isTauriRuntime()) {
            const returns = loadReturns();
            const salesReturn = returns.find(r => r.id === id);
            if (!salesReturn) return null;

            const allItems = loadReturnItems();
            const items = allItems.filter(i => i.return_id === id);

            // Get product names
            const products = await productService.getAll();
            const productMap = new Map(products.map(p => [p.id, p]));

            return {
                ...salesReturn,
                items: items.map(item => ({
                    ...item,
                    product_name: productMap.get(item.product_id)?.name,
                })),
            };
        }

        const db = await getDb();

        const returnResult = await db.select<SalesReturn[]>(
            `SELECT sr.*, i.customer_name, i.total_amount as original_invoice_total
       FROM sales_returns sr
       LEFT JOIN invoices i ON sr.invoice_id = i.id
       WHERE sr.id = $1`,
            [id]
        );

        if (returnResult.length === 0) return null;

        const items = await db.select<ReturnItem[]>(
            `SELECT ri.*, p.name as product_name
       FROM return_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE ri.return_id = $1`,
            [id]
        );

        return {
            ...returnResult[0],
            items,
        };
    },

    /**
     * Get returns for a specific invoice
     */
    async getByInvoiceId(invoiceId: string): Promise<SalesReturn[]> {
        if (!isTauriRuntime()) {
            return loadReturns()
                .filter(r => r.invoice_id === invoiceId)
                .sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime());
        }

        const db = await getDb();
        return await db.select<SalesReturn[]>(
            `SELECT * FROM sales_returns WHERE invoice_id = $1 ORDER BY return_date DESC`,
            [invoiceId]
        );
    },

    /**
     * Get total count of returns
     */
    async getCount(options: { fromDate?: string; toDate?: string } = {}): Promise<number> {
        const { fromDate, toDate } = options;

        if (!isTauriRuntime()) {
            let returns = loadReturns();
            if (fromDate) returns = returns.filter(r => r.return_date >= fromDate);
            if (toDate) returns = returns.filter(r => r.return_date <= toDate);
            return returns.length;
        }

        const db = await getDb();
        const conditions: string[] = [];
        const args: unknown[] = [];
        let argIdx = 1;

        if (fromDate) {
            conditions.push(`date(return_date) >= date($${argIdx++})`);
            args.push(fromDate);
        }
        if (toDate) {
            conditions.push(`date(return_date) <= date($${argIdx++})`);
            args.push(toDate);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await db.select<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM sales_returns ${whereSql}`,
            args
        );

        return result[0]?.count ?? 0;
    },

    /**
     * Get return statistics
     */
    async getStats(): Promise<{
        totalReturns: number;
        totalAmount: number;
        todayReturns: number;
        todayAmount: number;
    }> {
        if (!isTauriRuntime()) {
            const returns = loadReturns();
            const today = new Date().toISOString().slice(0, 10);
            const todayReturns = returns.filter(r => r.return_date.slice(0, 10) === today);

            return {
                totalReturns: returns.length,
                totalAmount: returns.reduce((sum, r) => sum + r.total_amount, 0),
                todayReturns: todayReturns.length,
                todayAmount: todayReturns.reduce((sum, r) => sum + r.total_amount, 0),
            };
        }

        const db = await getDb();

        const totalResult = await db.select<{ count: number; total: number }[]>(
            "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM sales_returns"
        );

        const todayResult = await db.select<{ count: number; total: number }[]>(
            "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM sales_returns WHERE date(return_date) = date('now')"
        );

        return {
            totalReturns: totalResult[0]?.count ?? 0,
            totalAmount: totalResult[0]?.total ?? 0,
            todayReturns: todayResult[0]?.count ?? 0,
            todayAmount: todayResult[0]?.total ?? 0,
        };
    },

    /**
     * Cancel a return (reverses stock changes)
     */
    async cancel(id: string, cancelledBy: string = 'system'): Promise<boolean> {
        const salesReturn = await this.getById(id);
        if (!salesReturn || salesReturn.status === 'cancelled') {
            return false;
        }

        if (!isTauriRuntime()) {
            const returns = loadReturns();
            const idx = returns.findIndex(r => r.id === id);
            if (idx >= 0) {
                returns[idx].status = 'cancelled';
                returns[idx].updated_at = new Date().toISOString();
                saveReturns(returns);
            }

            // Reverse stock changes
            for (const item of salesReturn.items) {
                await productService.updateQuantity(item.product_id, -item.quantity);
                await stockAdjustmentService.create(
                    item.product_id,
                    'manual_deduction',
                    -item.quantity,
                    `Cancelled return ${salesReturn.return_no}`,
                    cancelledBy
                );
            }

            return true;
        }

        const db = await getDb();

        await db.execute(
            "UPDATE sales_returns SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [id]
        );

        // Reverse stock changes
        for (const item of salesReturn.items) {
            await productService.updateQuantity(item.product_id, -item.quantity);
            await stockAdjustmentService.create(
                item.product_id,
                'manual_deduction',
                -item.quantity,
                `Cancelled return ${salesReturn.return_no}`,
                cancelledBy
            );
        }

        return true;
    },

    /**
     * Get set of invoice IDs that have been returned
     */
    async getReturnedInvoiceIds(): Promise<Set<string>> {
        if (!isTauriRuntime()) {
            const returns = loadReturns().filter(r => r.status === 'completed');
            return new Set(returns.map(r => r.invoice_id));
        }

        const db = await getDb();
        const results = await db.select<{ invoice_id: string }[]>(
            "SELECT DISTINCT invoice_id FROM sales_returns WHERE status = 'completed'"
        );
        return new Set(results.map(r => r.invoice_id));
    },
};
