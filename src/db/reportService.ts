import { getDb } from "./index";
import { invoiceService } from "./invoiceService";
import { productService } from "./productService";
import { isTauriRuntime } from "./runtime";

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
};

export type ProfitRow = {
  date: string;
  net_sales: number;
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
    const lowThreshold = 5;

    if (!isTauriRuntime()) {
      const products = await productService.getAll();
      return products
        .filter((p) => {
          if (onlyLowStock && p.quantity > lowThreshold) return false;
          if (!searchNorm) return true;
          return `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(searchNorm);
        })
        .map((p) => ({
          product_name: p.name,
          sku: p.sku ?? "",
          category: (p.category ?? "Uncategorized") || "Uncategorized",
          quantity: p.quantity,
          price: p.price,
          stock_value: p.price * p.quantity,
        }))
        .sort((a, b) => b.stock_value - a.stock_value);
    }

    const db = await getDb();
    const args: any[] = [];
    const where: string[] = [];

    if (onlyLowStock) {
      where.push("quantity <= " + lowThreshold);
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
        (price * quantity) as stock_value
      FROM products
      ${whereSql}
      ORDER BY stock_value DESC
      `,
      args
    );
  },

  async getProfitSummary(range: DateRange): Promise<ProfitRow[]> {
    // No cost-price in schema yet. We approximate profit using a constant margin.
    const APPROX_MARGIN_RATE = 0.2; // 20%

    const daily = await this.getDailySales(range);
    return daily.map((d) => ({
      date: d.date,
      net_sales: d.net_sales,
      approx_profit: Number((d.net_sales * APPROX_MARGIN_RATE).toFixed(2)),
    }));
  },
};
