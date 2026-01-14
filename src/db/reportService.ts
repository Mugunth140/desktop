import { FSNClassification } from "../types";
import { getDb } from "./index";
import { invoiceService } from "./invoiceService";
import { productService } from "./productService";
import { isTauriRuntime } from "./runtime";
import { settingsService } from "./settingsService";

export type DateRange = { from?: string; to?: string }; // YYYY-MM-DD

export type DailySalesRow = {
  date: string;
  invoices: number;
  items_sold: number;
  net_sales: number;
  discount_total: number;
};

export type ProductSalesRow = {
  product_name: string;
  sku: string;
  quantity_sold: number;
  sales_amount: number;
};

export type StockRow = {
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  stock_value: number;
  reorder_level?: number;
  status?: 'critical' | 'low' | 'adequate';
};

export type NonMovingRow = {
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  stock_value: number;
  days_since_sale: number | null;
  fsn_classification: FSNClassification;
  last_sale_date: string | null;
};

export type ProfitRow = {
  date: string;
  net_sales: number;
  total_cost: number;
  approx_profit: number;
};

const clampRangeSql = (range: DateRange) => {
  // We treat created_at as ISO string in SQLite.
  // Range uses date(created_at) comparison for simplicity.
  const where: string[] = [];
  const args: any[] = [];

  if (range.from) {
    where.push("date(created_at) >= date($" + (args.length + 1) + ")");
    args.push(range.from);
  }
  if (range.to) {
    where.push("date(created_at) <= date($" + (args.length + 1) + ")");
    args.push(range.to);
  }

  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", args };
};

// Helper to calculate days since a date
const daysSince = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const saleDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - saleDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

// Helper to get FSN classification based on days since last sale
const getFSN = (daysSinceSale: number | null, thresholdDays: number): FSNClassification => {
  if (daysSinceSale === null) return 'N'; // Never sold = Non-moving
  if (daysSinceSale <= 30) return 'F'; // Fast
  if (daysSinceSale <= thresholdDays) return 'S'; // Slow
  return 'N'; // Non-moving
};

export const reportService = {
  async getDailySales(range: DateRange): Promise<DailySalesRow[]> {
    if (!isTauriRuntime()) {
      // Web fallback: compute on demand
      const invoices = await invoiceService.getAll();
      const itemsByInvoice = new Map<string, number>();
      for (const inv of invoices) {
        const items = await invoiceService.getItems(inv.id);
        const count = items.reduce((s, it) => s + it.quantity, 0);
        itemsByInvoice.set(inv.id, count);
      }
      const from = range.from ? new Date(range.from) : null;
      const to = range.to ? new Date(range.to) : null;

      const rowsByDate = new Map<string, DailySalesRow>();
      for (const inv of invoices) {
        const d = inv.created_at.slice(0, 10);
        const invDate = new Date(d);
        if (from && invDate < from) continue;
        if (to && invDate > to) continue;

        const existing = rowsByDate.get(d) ?? {
          date: d,
          invoices: 0,
          items_sold: 0,
          net_sales: 0,
          discount_total: 0,
        };
        existing.invoices += 1;
        existing.items_sold += itemsByInvoice.get(inv.id) ?? 0;
        existing.net_sales += inv.total_amount ?? 0;
        existing.discount_total += inv.discount_amount ?? 0;
        rowsByDate.set(d, existing);
      }

      return Array.from(rowsByDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    }

    const db = await getDb();
    const { whereSql, args } = clampRangeSql(range);

    // Simple + index-friendly aggregates
    return await db.select<DailySalesRow[]>(
      `
      SELECT
        date(i.created_at) as date,
        COUNT(*) as invoices,
        COALESCE(SUM((SELECT COALESCE(SUM(ii.quantity),0) FROM invoice_items ii WHERE ii.invoice_id = i.id)), 0) as items_sold,
        COALESCE(SUM(i.total_amount), 0) as net_sales,
        COALESCE(SUM(i.discount_amount), 0) as discount_total
      FROM invoices i
      ${whereSql.replace(/created_at/g, "i.created_at")}
      GROUP BY date(i.created_at)
      ORDER BY date(i.created_at) DESC
      `,
      args
    );
  },

  async getProductSales(range: DateRange, search?: string): Promise<ProductSalesRow[]> {
    const searchNorm = (search ?? "").trim().toLowerCase();

    if (!isTauriRuntime()) {
      const invoices = await invoiceService.getAll();
      const from = range.from ? new Date(range.from) : null;
      const to = range.to ? new Date(range.to) : null;

      const products = await productService.getAll();
      const byId = new Map(products.map((p) => [p.id, p] as const));

      const agg = new Map<string, ProductSalesRow>();
      for (const inv of invoices) {
        const d = new Date(inv.created_at.slice(0, 10));
        if (from && d < from) continue;
        if (to && d > to) continue;

        const items = await invoiceService.getItems(inv.id);
        for (const it of items) {
          const p = byId.get(it.product_id);
          const name = p?.name ?? it.product_name ?? it.product_id;
          const sku = p?.sku ?? "";
          if (searchNorm) {
            const hay = `${name} ${sku}`.toLowerCase();
            if (!hay.includes(searchNorm)) continue;
          }
          const key = it.product_id;
          const existing = agg.get(key) ?? {
            product_name: name,
            sku,
            quantity_sold: 0,
            sales_amount: 0,
          };
          existing.quantity_sold += it.quantity;
          existing.sales_amount += it.quantity * it.price;
          agg.set(key, existing);
        }
      }
      return Array.from(agg.values()).sort((a, b) => b.sales_amount - a.sales_amount);
    }

    const db = await getDb();
    const { whereSql, args } = clampRangeSql(range);

    const whereParts: string[] = [];
    if (whereSql) whereParts.push(whereSql.replace("WHERE ", ""));

    if (searchNorm) {
      whereParts.push("(lower(p.name) LIKE $" + (args.length + 1) + " OR lower(COALESCE(p.sku,'')) LIKE $" + (args.length + 2) + ")");
      args.push(`%${searchNorm}%`, `%${searchNorm}%`);
    }

    const finalWhere = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    return await db.select<ProductSalesRow[]>(
      `
      SELECT
        p.name as product_name,
        COALESCE(p.sku, '') as sku,
        COALESCE(SUM(ii.quantity), 0) as quantity_sold,
        COALESCE(SUM(ii.quantity * ii.price), 0) as sales_amount
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      LEFT JOIN products p ON p.id = ii.product_id
      ${finalWhere.replace(/created_at/g, "i.created_at")}
      GROUP BY ii.product_id
      ORDER BY sales_amount DESC
      `,
      args
    );
  },

  async getCurrentStock(search?: string, onlyLowStock?: boolean): Promise<StockRow[]> {
    const searchNorm = (search ?? "").trim().toLowerCase();

    // Get settings for low stock detection
    const lowStockMethod = await settingsService.get('low_stock_method');
    const lowStockPercentage = await settingsService.get('low_stock_percentage');
    const lowStockDaysSupply = await settingsService.get('low_stock_days_supply');

    if (!isTauriRuntime()) {
      const products = await productService.getAll();

      // For days_supply method, we need average daily sales
      let avgDailySales: Map<string, number> | null = null;
      if (lowStockMethod === 'days_supply') {
        avgDailySales = new Map();
        const invoices = await invoiceService.getAll();
        const salesByProduct = new Map<string, { qty: number; firstSale: Date; lastSale: Date }>();

        for (const inv of invoices) {
          const items = await invoiceService.getItems(inv.id);
          const saleDate = new Date(inv.created_at);
          for (const it of items) {
            const existing = salesByProduct.get(it.product_id);
            if (existing) {
              existing.qty += it.quantity;
              if (saleDate < existing.firstSale) existing.firstSale = saleDate;
              if (saleDate > existing.lastSale) existing.lastSale = saleDate;
            } else {
              salesByProduct.set(it.product_id, { qty: it.quantity, firstSale: saleDate, lastSale: saleDate });
            }
          }
        }

        for (const [productId, data] of salesByProduct) {
          const daysDiff = Math.max(1, Math.ceil((data.lastSale.getTime() - data.firstSale.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          avgDailySales.set(productId, data.qty / daysDiff);
        }
      }

      return products
        .filter((p) => {
          // Check if low stock based on method
          let isLow = false;
          if (lowStockMethod === 'reorder_level') {
            isLow = p.quantity <= (p.reorder_level || 5);
          } else if (lowStockMethod === 'percentage') {
            const maxStock = p.max_stock || 100;
            const threshold = maxStock * (lowStockPercentage / 100);
            isLow = p.quantity <= threshold;
          } else if (lowStockMethod === 'days_supply') {
            const dailySales = avgDailySales?.get(p.id) || 0;
            if (dailySales > 0) {
              const daysRemaining = p.quantity / dailySales;
              isLow = daysRemaining <= lowStockDaysSupply;
            } else {
              // No sales history - consider it adequate
              isLow = false;
            }
          }

          if (onlyLowStock && !isLow) return false;
          if (!searchNorm) return true;
          return `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(searchNorm);
        })
        .map((p) => {
          // Determine status
          let status: 'critical' | 'low' | 'adequate' = 'adequate';
          if (p.quantity <= 0) {
            status = 'critical';
          } else if (lowStockMethod === 'reorder_level') {
            if (p.quantity <= (p.reorder_level || 5) / 2) status = 'critical';
            else if (p.quantity <= (p.reorder_level || 5)) status = 'low';
          } else if (lowStockMethod === 'percentage') {
            const maxStock = p.max_stock || 100;
            const threshold = maxStock * (lowStockPercentage / 100);
            if (p.quantity <= threshold / 2) status = 'critical';
            else if (p.quantity <= threshold) status = 'low';
          }

          return {
            product_name: p.name,
            sku: p.sku ?? "",
            category: (p.category ?? "Uncategorized") || "Uncategorized",
            quantity: p.quantity,
            price: p.price,
            stock_value: p.price * p.quantity,
            reorder_level: p.reorder_level,
            status,
          };
        })
        .sort((a, b) => b.stock_value - a.stock_value);
    }

    const db = await getDb();
    const args: any[] = [];
    const where: string[] = [];

    if (onlyLowStock) {
      if (lowStockMethod === 'reorder_level') {
        where.push("quantity <= COALESCE(reorder_level, 5)");
      } else if (lowStockMethod === 'percentage') {
        where.push(`quantity <= (COALESCE(max_stock, 100) * ${lowStockPercentage} / 100)`);
      }
      // days_supply is complex and needs subquery - simplified for now
    }

    if (searchNorm) {
      where.push("(lower(name) LIKE $" + (args.length + 1) + " OR lower(COALESCE(sku,'')) LIKE $" + (args.length + 2) + ")");
      args.push(`%${searchNorm}%`, `%${searchNorm}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    return await db.select<StockRow[]>(
      `
      SELECT
        name as product_name,
        COALESCE(sku, '') as sku,
        COALESCE(category, 'Uncategorized') as category,
        quantity as quantity,
        price as price,
        (price * quantity) as stock_value,
        reorder_level
      FROM products
      ${whereSql}
      ORDER BY stock_value DESC
      `,
      args
    );
  },

  async getNonMovingItems(fsnFilter?: FSNClassification): Promise<NonMovingRow[]> {
    const thresholdDays = await settingsService.get('non_moving_threshold_days');

    // First, recalculate FSN classifications
    await productService.calculateFSN(thresholdDays);

    if (!isTauriRuntime()) {
      const products = await productService.getAll();

      return products
        .filter((p) => {
          if (!fsnFilter) return true;
          const days = daysSince(p.last_sale_date);
          const fsn = getFSN(days, thresholdDays);
          return fsn === fsnFilter;
        })
        .map((p) => {
          const days = daysSince(p.last_sale_date);
          return {
            product_name: p.name,
            sku: p.sku ?? "",
            category: (p.category ?? "Uncategorized") || "Uncategorized",
            quantity: p.quantity,
            stock_value: p.price * p.quantity,
            days_since_sale: days,
            fsn_classification: getFSN(days, thresholdDays),
            last_sale_date: p.last_sale_date,
          };
        })
        .sort((a, b) => {
          // Sort by FSN (N first, then S, then F), then by stock value
          const fsnOrder = { 'N': 0, 'S': 1, 'F': 2 };
          const orderDiff = fsnOrder[a.fsn_classification] - fsnOrder[b.fsn_classification];
          if (orderDiff !== 0) return orderDiff;
          return b.stock_value - a.stock_value;
        });
    }

    const db = await getDb();
    const args: any[] = [];
    let whereSql = "";

    if (fsnFilter) {
      whereSql = "WHERE fsn_classification = $1";
      args.push(fsnFilter);
    }

    const rows = await db.select<{
      name: string;
      sku: string;
      category: string;
      quantity: number;
      price: number;
      last_sale_date: string | null;
      fsn_classification: FSNClassification | null;
    }[]>(
      `
      SELECT
        name,
        COALESCE(sku, '') as sku,
        COALESCE(category, 'Uncategorized') as category,
        quantity,
        price,
        last_sale_date,
        fsn_classification
      FROM products
      ${whereSql}
      ORDER BY 
        CASE fsn_classification WHEN 'N' THEN 0 WHEN 'S' THEN 1 WHEN 'F' THEN 2 ELSE 3 END,
        (price * quantity) DESC
      `,
      args
    );

    return rows.map((r) => {
      const days = daysSince(r.last_sale_date);
      return {
        product_name: r.name,
        sku: r.sku,
        category: r.category,
        quantity: r.quantity,
        stock_value: r.price * r.quantity,
        days_since_sale: days,
        fsn_classification: r.fsn_classification || getFSN(days, thresholdDays),
        last_sale_date: r.last_sale_date,
      };
    });
  },

  async getProfitSummary(range: DateRange): Promise<ProfitRow[]> {
    if (!isTauriRuntime()) {
      // Web fallback: compute using actual cost_price from invoice items
      const invoices = await invoiceService.getAll();
      const from = range.from ? new Date(range.from) : null;
      const to = range.to ? new Date(range.to) : null;

      const rowsByDate = new Map<string, ProfitRow>();
      for (const inv of invoices) {
        const d = inv.created_at.slice(0, 10);
        const invDate = new Date(d);
        if (from && invDate < from) continue;
        if (to && invDate > to) continue;

        const items = await invoiceService.getItems(inv.id);
        let totalRevenue = 0;
        let totalCost = 0;

        for (const item of items) {
          totalRevenue += item.quantity * item.price;
          totalCost += item.quantity * (item.cost_price || 0);
        }

        const existing = rowsByDate.get(d) ?? {
          date: d,
          net_sales: 0,
          total_cost: 0,
          approx_profit: 0,
        };
        existing.net_sales += totalRevenue;
        existing.total_cost += totalCost;
        existing.approx_profit = existing.net_sales - existing.total_cost;
        rowsByDate.set(d, existing);
      }

      return Array.from(rowsByDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    }

    const db = await getDb();
    const { whereSql, args } = clampRangeSql(range);

    // Query using actual cost_price from invoice_items
    return await db.select<ProfitRow[]>(
      `
      SELECT
        date(i.created_at) as date,
        COALESCE(SUM(ii.quantity * ii.price), 0) as net_sales,
        COALESCE(SUM(ii.quantity * COALESCE(ii.cost_price, 0)), 0) as total_cost,
        COALESCE(SUM(ii.quantity * ii.price), 0) - COALESCE(SUM(ii.quantity * COALESCE(ii.cost_price, 0)), 0) as approx_profit
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      ${whereSql.replace(/created_at/g, "i.created_at")}
      GROUP BY date(i.created_at)
      ORDER BY date(i.created_at) DESC
      `,
      args
    );
  },
};
