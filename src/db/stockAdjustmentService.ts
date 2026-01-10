import { v4 as uuidv4 } from "uuid";
import { AdjustmentType, StockAdjustment } from "../types";
import { getDb } from "./index";
import { isTauriRuntime } from "./runtime";

const ADJUSTMENTS_KEY = "motormods_stock_adjustments_v1";

interface AdjustmentFilters {
    productId?: string;
    adjustmentType?: AdjustmentType;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
}

const loadAdjustments = (): StockAdjustment[] => {
    try {
        const raw = localStorage.getItem(ADJUSTMENTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as StockAdjustment[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveAdjustments = (adjustments: StockAdjustment[]) => {
    localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify(adjustments));
};

export const stockAdjustmentService = {
    /**
     * Create a new stock adjustment record (audit log entry)
     * This does NOT modify the product quantity - use productService.updateQuantity for that
     */
    async create(
        productId: string,
        adjustmentType: AdjustmentType,
        quantity: number,
        notes: string | null,
        createdBy: string = 'system'
    ): Promise<StockAdjustment> {
        const adjustment: StockAdjustment = {
            id: uuidv4(),
            product_id: productId,
            adjustment_type: adjustmentType,
            quantity,
            notes,
            created_by: createdBy,
            created_at: new Date().toISOString(),
        };

        if (!isTauriRuntime()) {
            const adjustments = loadAdjustments();
            adjustments.push(adjustment);
            saveAdjustments(adjustments);
            return adjustment;
        }

        const db = await getDb();
        await db.execute(
            `INSERT INTO stock_adjustments (id, product_id, adjustment_type, quantity, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                adjustment.id,
                adjustment.product_id,
                adjustment.adjustment_type,
                adjustment.quantity,
                adjustment.notes,
                adjustment.created_by,
                adjustment.created_at,
            ]
        );

        return adjustment;
    },

    /**
     * Get all adjustments for a specific product
     */
    async getByProductId(productId: string): Promise<StockAdjustment[]> {
        if (!isTauriRuntime()) {
            return loadAdjustments()
                .filter(a => a.product_id === productId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        const db = await getDb();
        return await db.select<StockAdjustment[]>(
            `SELECT sa.*, p.name as product_name
       FROM stock_adjustments sa
       LEFT JOIN products p ON sa.product_id = p.id
       WHERE sa.product_id = $1
       ORDER BY sa.created_at DESC`,
            [productId]
        );
    },

    /**
     * Get all adjustments with optional filters
     */
    async getAll(filters: AdjustmentFilters = {}): Promise<StockAdjustment[]> {
        const { productId, adjustmentType, fromDate, toDate, limit = 100, offset = 0 } = filters;

        if (!isTauriRuntime()) {
            let adjustments = loadAdjustments();

            if (productId) {
                adjustments = adjustments.filter(a => a.product_id === productId);
            }
            if (adjustmentType) {
                adjustments = adjustments.filter(a => a.adjustment_type === adjustmentType);
            }
            if (fromDate) {
                adjustments = adjustments.filter(a => a.created_at >= fromDate);
            }
            if (toDate) {
                adjustments = adjustments.filter(a => a.created_at <= toDate);
            }

            return adjustments
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(offset, offset + limit);
        }

        const db = await getDb();
        const conditions: string[] = [];
        const args: unknown[] = [];
        let argIdx = 1;

        if (productId) {
            conditions.push(`sa.product_id = $${argIdx++}`);
            args.push(productId);
        }
        if (adjustmentType) {
            conditions.push(`sa.adjustment_type = $${argIdx++}`);
            args.push(adjustmentType);
        }
        if (fromDate) {
            conditions.push(`date(sa.created_at) >= date($${argIdx++})`);
            args.push(fromDate);
        }
        if (toDate) {
            conditions.push(`date(sa.created_at) <= date($${argIdx++})`);
            args.push(toDate);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return await db.select<StockAdjustment[]>(
            `SELECT sa.*, p.name as product_name
       FROM stock_adjustments sa
       LEFT JOIN products p ON sa.product_id = p.id
       ${whereSql}
       ORDER BY sa.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
            args
        );
    },

    /**
     * Get count of adjustments (for pagination)
     */
    async getCount(filters: Omit<AdjustmentFilters, 'limit' | 'offset'> = {}): Promise<number> {
        const { productId, adjustmentType, fromDate, toDate } = filters;

        if (!isTauriRuntime()) {
            let adjustments = loadAdjustments();

            if (productId) {
                adjustments = adjustments.filter(a => a.product_id === productId);
            }
            if (adjustmentType) {
                adjustments = adjustments.filter(a => a.adjustment_type === adjustmentType);
            }
            if (fromDate) {
                adjustments = adjustments.filter(a => a.created_at >= fromDate);
            }
            if (toDate) {
                adjustments = adjustments.filter(a => a.created_at <= toDate);
            }

            return adjustments.length;
        }

        const db = await getDb();
        const conditions: string[] = [];
        const args: unknown[] = [];
        let argIdx = 1;

        if (productId) {
            conditions.push(`product_id = $${argIdx++}`);
            args.push(productId);
        }
        if (adjustmentType) {
            conditions.push(`adjustment_type = $${argIdx++}`);
            args.push(adjustmentType);
        }
        if (fromDate) {
            conditions.push(`date(created_at) >= date($${argIdx++})`);
            args.push(fromDate);
        }
        if (toDate) {
            conditions.push(`date(created_at) <= date($${argIdx++})`);
            args.push(toDate);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await db.select<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM stock_adjustments ${whereSql}`,
            args
        );

        return result[0]?.count ?? 0;
    },

    /**
     * Get adjustment summary by type for a product
     */
    async getSummaryByProduct(productId: string): Promise<Record<AdjustmentType, number>> {
        const summary: Record<AdjustmentType, number> = {
            opening_stock: 0,
            manual_add: 0,
            manual_deduction: 0,
            supplier_return: 0,
            damage_write_off: 0,
            sale: 0,
            return: 0,
            other: 0,
        };

        if (!isTauriRuntime()) {
            const adjustments = loadAdjustments().filter(a => a.product_id === productId);
            for (const adj of adjustments) {
                summary[adj.adjustment_type] = (summary[adj.adjustment_type] || 0) + adj.quantity;
            }
            return summary;
        }

        const db = await getDb();
        const rows = await db.select<{ adjustment_type: AdjustmentType; total: number }[]>(
            `SELECT adjustment_type, SUM(quantity) as total
       FROM stock_adjustments
       WHERE product_id = $1
       GROUP BY adjustment_type`,
            [productId]
        );

        for (const row of rows) {
            summary[row.adjustment_type] = row.total;
        }

        return summary;
    },
};
