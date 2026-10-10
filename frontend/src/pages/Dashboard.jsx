import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Factory, Award, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const API_BASE = 'http://localhost:8000/api/orders-finance';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'];

export default function Dashboard() {
  const [data, setData] = useState({
    kpis: {
      total_revenue: 1245000,
      total_costs: 840000,
      total_profit: 405000,
      total_dispatches: 18,
      total_orders: 8
    },
    monthly_trends: [
      { month: 'May', revenue: 180000, expenses: 130000, profit: 50000 },
      { month: 'Jun', revenue: 220000, expenses: 150000, profit: 70000 },
      { month: 'Jul', revenue: 260000, expenses: 175000, profit: 85000 },
      { month: 'Aug', revenue: 310000, expenses: 210000, profit: 100000 },
      { month: 'Sep', revenue: 290000, expenses: 195000, profit: 95000 },
      { month: 'Oct', revenue: 350000, expenses: 230000, profit: 120000 },
    ],
    cost_breakdown: [
      { name: 'Raw Material (Yarn)', value: 480000 },
      { name: 'Worker Wages', value: 240000 },
      { name: 'Machine & Power', value: 120000 },
    ]
  });

  useEffect(() => {
    const fetchFinance = async () => {
      try {
        const res = await fetch(`${API_BASE}/finance/dashboard`);
        if (res.ok) {
          const apiData = await res.json();
          setData(apiData);
        }
      } catch {
        // Keeps state defaults if offline
      }
    };
    fetchFinance();
  }, []);

  const profitMargin = data.kpis.total_revenue > 0 
    ? Math.round((data.kpis.total_profit / data.kpis.total_revenue) * 100) 
    : 32;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">Scene 6: Owner Overview</span>
          <h1 className="text-2xl font-bold mt-1">Closing the Books: Mill Profit & Cost Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Raw material bills, worker wages, and buyer payments consolidated in one real-time dashboard.
          </p>
        </div>
        <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700 flex items-center gap-3">
          <Award className="h-8 w-8 text-amber-400" />
          <div>
            <div className="text-xs text-slate-400">Net Profit Margin</div>
            <div className="text-xl font-bold text-amber-400">{profitMargin}%</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{data.kpis.total_revenue?.toLocaleString()}</div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center mt-1">
            <ArrowUpRight className="h-3.5 w-3.5" /> From all buyer shipments
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Factory Costs</span>
            <Factory className="h-5 w-5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{data.kpis.total_costs?.toLocaleString()}</div>
          <span className="text-xs text-rose-500 font-semibold flex items-center mt-1">
            Yarn + Wages + Maintenance
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Mill Profit</span>
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{data.kpis.total_profit?.toLocaleString()}</div>
          <span className="text-xs text-amber-600 font-semibold flex items-center mt-1">
            Profit after closing the books
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Dispatches & Orders</span>
            <Users className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{data.kpis.total_dispatches} Trucks Loaded</div>
          <span className="text-xs text-indigo-600 font-semibold flex items-center mt-1">
            {data.kpis.total_orders} Total Orders Processed
          </span>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue vs Cost Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Monthly Financial Trend (Revenue vs Cost)</h2>
          <p className="text-xs text-slate-500 mb-4">Track month-by-month mill profitability</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_trends}>
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Operating Costs" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Net Profit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Factory Cost Breakdown</h2>
          <p className="text-xs text-slate-500 mb-4">Raw material vs wages vs machines</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.cost_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.cost_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            {data.cost_breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  {item.name}
                </span>
                <span className="font-bold text-slate-800">₹{item.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
