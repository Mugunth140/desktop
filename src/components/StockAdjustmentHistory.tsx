import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    History,
    Package,
    Search
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { stockAdjustmentService } from "../db/stockAdjustmentService";
import { useDebounce } from "../hooks";
import { ADJUSTMENT_TYPE_LABELS, AdjustmentType, StockAdjustment } from "../types";
import { Badge, Button, Card, EmptyState, Input } from "./ui";

interface StockAdjustmentHistoryProps {
    productId?: string;
}

export const StockAdjustmentHistory: React.FC<StockAdjustmentHistoryProps> = ({ productId }) => {
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 25;

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [adjustmentType, setAdjustmentType] = useState<AdjustmentType | "">("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);

    const loadAdjustments = useCallback(async () => {
        setLoading(true);
        try {
            const filters = {
                productId,
                adjustmentType: adjustmentType || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
            };

            const [data, count] = await Promise.all([
                stockAdjustmentService.getAll(filters),
                stockAdjustmentService.getCount(filters),
            ]);

            setAdjustments(data);
            setTotalCount(count);
        } catch (error) {
            console.error("Failed to load adjustments:", error);
        } finally {
            setLoading(false);
        }
    }, [productId, adjustmentType, fromDate, toDate, page]);

    useEffect(() => {
        loadAdjustments();
    }, [loadAdjustments]);

    useEffect(() => {
        setPage(1);
    }, [adjustmentType, fromDate, toDate]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // Filter by product name client-side
    const filteredAdjustments = adjustments.filter(adj => {
        if (!debouncedSearch) return true;
        const search = debouncedSearch.toLowerCase();
        return (
            adj.product_name?.toLowerCase().includes(search) ||
            adj.notes?.toLowerCase().includes(search) ||
            adj.created_by.toLowerCase().includes(search)
        );
    });

    const getTypeBadge = (type: AdjustmentType) => {
        const variants: Record<AdjustmentType, "success" | "warning" | "danger" | "info" | "neutral"> = {
            opening_stock: "info",
            manual_add: "success",
            manual_deduction: "warning",
            supplier_return: "info",
            damage_write_off: "danger",
            sale: "neutral",
            return: "success",
            other: "neutral",
        };
        return <Badge variant={variants[type]}>{ADJUSTMENT_TYPE_LABELS[type]}</Badge>;
    };

    const exportToCsv = () => {
        const headers = ["Date", "Product", "Type", "Quantity", "Notes", "User"];
        const rows = adjustments.map(adj => [
            new Date(adj.created_at).toLocaleString(),
            adj.product_name || "Unknown",
            ADJUSTMENT_TYPE_LABELS[adj.adjustment_type],
            adj.quantity.toString(),
            adj.notes || "",
            adj.created_by,
        ]);

        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stock_adjustments_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading && adjustments.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <Card padding="none" className="flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <History size={20} className="text-teal-600" />
                    <h2 className="text-lg font-bold text-slate-800">Stock Adjustment History</h2>
                </div>
                <Button variant="secondary" onClick={exportToCsv} leftIcon={<Download size={16} />}>
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
                <Input
                    placeholder="Search product, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search size={16} />}
                    className="w-64"
                />
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType | "")}
                        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                        <option value="">All Types</option>
                        {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-36"
                    />
                    <span className="text-slate-400">to</span>
                    <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-36"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {filteredAdjustments.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title="No adjustments found"
                        description="Stock adjustments will appear here when products are adjusted"
                    />
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Qty</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAdjustments.map((adj) => (
                                <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-4 text-sm text-slate-600">
                                        {new Date(adj.created_at).toLocaleDateString()}
                                        <span className="block text-xs text-slate-400">
                                            {new Date(adj.created_at).toLocaleTimeString()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-800 font-medium">
                                        {adj.product_name || "Unknown Product"}
                                    </td>
                                    <td className="p-4">{getTypeBadge(adj.adjustment_type)}</td>
                                    <td className="p-4 text-center">
                                        <span className={`font-mono font-semibold ${adj.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {adj.quantity >= 0 ? '+' : ''}{adj.quantity}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-slate-500 max-w-xs truncate">
                                        {adj.notes || "-"}
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">{adj.created_by}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {filteredAdjustments.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
                        <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} records)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            leftIcon={<ChevronLeft size={16} />}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            leftIcon={<ChevronRight size={16} />}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};
