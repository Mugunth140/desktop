import { ArrowUpRight, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import React from "react";
import { Card } from "./ui";

interface DashboardProps {
    onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    // Mock data for now - in a real app, this would come from services
    const stats = [
        { label: "Today's Sales", value: "₹12,450", change: "+12%", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { label: "Invoices", value: "18", change: "+4", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Low Stock Items", value: "5", change: "-2", icon: Package, color: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Monthly Revenue", value: "₹3.2L", change: "+8%", icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    ];

    const recentActivity = [
        { id: 1, type: "Invoice", desc: "Invoice #1024 - John Doe", time: "10 mins ago", amount: "₹2,400" },
        { id: 2, type: "Stock", desc: "Restocked 'Brake Pads'", time: "1 hour ago", amount: "+50 units" },
        { id: 3, type: "Invoice", desc: "Invoice #1023 - Jane Smith", time: "2 hours ago", amount: "₹850" },
        { id: 4, type: "Return", desc: "Return #R-001 - Defective Light", time: "4 hours ago", amount: "-₹1,200" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                <p className="text-slate-500">Overview of your business performance</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <Card key={index} className="p-4 border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
                            </div>
                            <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs">
                            <span className="text-emerald-600 font-medium flex items-center">
                                {stat.change} <ArrowUpRight size={12} className="ml-0.5" />
                            </span>
                            <span className="text-slate-400 ml-2">from yesterday</span>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Recent Activity</h2>
                        <button onClick={() => onNavigate("invoices")} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                            View All
                        </button>
                    </div>
                    <Card className="divide-y divide-slate-100 border-slate-100 shadow-sm">
                        {recentActivity.map((item) => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === "Invoice" ? "bg-blue-100 text-blue-600" :
                                            item.type === "Stock" ? "bg-emerald-100 text-emerald-600" :
                                                "bg-amber-100 text-amber-600"
                                        }`}>
                                        {item.type === "Invoice" ? <ShoppingCart size={18} /> :
                                            item.type === "Stock" ? <Package size={18} /> :
                                                <TrendingUp size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{item.desc}</p>
                                        <p className="text-xs text-slate-500">{item.time}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{item.amount}</span>
                            </div>
                        ))}
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => onNavigate("billing")}
                            className="p-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-between group"
                        >
                            <span className="font-semibold">New Invoice</span>
                            <ArrowUpRight size={20} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <button
                            onClick={() => onNavigate("stock")}
                            className="p-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md transition-all flex items-center justify-between group"
                        >
                            <span className="font-medium">Add Product</span>
                            <Package size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </button>
                        <button
                            onClick={() => onNavigate("reports")}
                            className="p-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md transition-all flex items-center justify-between group"
                        >
                            <span className="font-medium">View Reports</span>
                            <TrendingUp size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
