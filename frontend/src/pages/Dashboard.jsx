import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Factory, Award, ArrowUpRight, ArrowRight, Layers, ShieldCheck, Truck, PackageCheck, ReceiptText } from 'lucide-react';
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

import { API_BASE, authFetch } from '../api';

// Earthy Sage, Linen, Sand, and Terracotta Theme Palette
const THEME_COLORS = ['#53634F', '#8E9F8A', '#BFA882', '#C27D60'];

const ROLE_DASHBOARDS = [
  { id: 'store-dashboard', title: 'Store Keeper', description: 'Stock levels and low-stock alerts', icon: Layers },
  { id: 'floor-dashboard', title: 'Floor Supervisor', description: 'Machine readiness and QC status', icon: ShieldCheck },
  { id: 'dispatch-dashboard', title: 'Dispatch Section', description: 'Open orders and available rolls', icon: Truck },
  { id: 'buyer-dashboard', title: 'Buyer', description: 'Order progress and delivery dates', icon: PackageCheck },
];

export default function Dashboard({ setActiveTab }) {
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    kpis: {
      total_revenue: 0,
      total_costs: 0,
      total_profit: 0,
      total_dispatches: 0,
      total_orders: 0,
      buyer_payments_received: 0,
      buyer_receivables: 0,
      supplier_payments_paid: 0,
      worker_wages_paid: 0,
    },
    monthly_trends: [
      { month: 'May', revenue: 0, expenses: 0, profit: 0 },
      { month: 'Jun', revenue: 0, expenses: 0, profit: 0 },
      { month: 'Jul', revenue: 0, expenses: 0, profit: 0 },
      { month: 'Aug', revenue: 0, expenses: 0, profit: 0 },
      { month: 'Sep', revenue: 0, expenses: 0, profit: 0 },
      { month: 'Oct', revenue: 0, expenses: 0, profit: 0 },
    ],
    cost_breakdown: [
      { name: 'Supplier Bills (Yarn)', value: 0 },
      { name: 'Recorded Attendance Wages', value: 0 },
      { name: 'Machine & Power (Estimated)', value: 0 },
    ]
  });

  useEffect(() => {
    const fetchFinance = async () => {
      try {
        setError(null);
        const res = await authFetch(`${API_BASE}/api/orders-finance/finance/dashboard`);
        if (res.ok) {
          const apiData = await res.json();
          setData(apiData);
          setIsOffline(false);
        } else {
          const errBody = await res.json().catch(() => ({}));
          setError(errBody.detail || `Failed to fetch finance data (HTTP ${res.status})`);
        }
      } catch {
        // Network error only
        setIsOffline(true);
      }
    };
    fetchFinance();
  }, []);

  const profitMargin = data.kpis.total_revenue > 0 
    ? Math.round((data.kpis.total_profit / data.kpis.total_revenue) * 100) 
    : 0;
  const hasMonthlyData = data.monthly_trends.some(
    (month) => month.revenue > 0 || month.expenses > 0
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Executive Header Banner in Deep Sage */}
      <div className="bg-[#53634F] text-[#FAF7F2] p-6 sm:p-8 rounded-3xl shadow-md border border-[#42503F] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#DDD4C7] font-semibold block">
              Scene 6: Owner Overview
            </span>
            {isOffline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF3F0] text-[#C27D60] border border-[#EACFC5]">
                Offline demo data
              </span>
            )}
          </div>
          <h1 className="font-editorial text-2xl sm:text-4xl text-white font-normal">
            Mill Profit & Cost Center
          </h1>
          <p className="text-xs sm:text-sm text-[#E2E8E0] mt-1.5 font-light max-w-2xl leading-relaxed">
            Consolidated financial telemetry: raw yarn invoices, loom operator wages, and buyer dispatch settlements.
          </p>
          {error && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-300/40 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="bg-[#42503F] px-6 py-4 rounded-2xl border border-[#5E6F5A] flex items-center gap-4 shadow-inner">
          <Award className="h-8 w-8 text-[#DDD4C7]" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#DDD4C7] font-medium">Net Margin</div>
            <div className="font-editorial text-3xl font-medium text-white">{profitMargin}%</div>
          </div>
        </div>
      </div>

      {/* KPI Cards in Warm Linen & Sage Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#FAF7F2] p-6 rounded-2xl border border-[#E3DDD3] shadow-sm hover:border-[#53634F]/40 transition-all">
          <div className="flex justify-between items-center text-[#6C7B67] mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest">Total Revenue</span>
            <span className="p-2 rounded-full bg-[#E7ECE4] text-[#53634F]">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="font-editorial text-3xl font-medium text-[#2A3528]">
            ₹{data.kpis.total_revenue?.toLocaleString()}
          </div>
          <span className="text-xs text-[#53634F] font-medium flex items-center mt-2 gap-1">
            <ArrowUpRight className="h-3.5 w-3.5" /> All buyer dispatches
          </span>
        </div>

        <div className="bg-[#FAF7F2] p-6 rounded-2xl border border-[#E3DDD3] shadow-sm hover:border-[#53634F]/40 transition-all">
          <div className="flex justify-between items-center text-[#6C7B67] mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest">Total Costs</span>
            <span className="p-2 rounded-full bg-[#F5ECE8] text-[#C27D60]">
              <Factory className="h-4 w-4" />
            </span>
          </div>
          <div className="font-editorial text-3xl font-medium text-[#2A3528]">
            ₹{data.kpis.total_costs?.toLocaleString()}
          </div>
          <span className="text-xs text-[#C27D60] font-medium flex items-center mt-2 gap-1">
            Yarn, wages & power
          </span>
        </div>

        <div className="bg-[#FAF7F2] p-6 rounded-2xl border border-[#E3DDD3] shadow-sm hover:border-[#53634F]/40 transition-all">
          <div className="flex justify-between items-center text-[#6C7B67] mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest">Net Mill Profit</span>
            <span className="p-2 rounded-full bg-[#EFEAE0] text-[#BFA882]">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="font-editorial text-3xl font-medium text-[#53634F]">
            ₹{data.kpis.total_profit?.toLocaleString()}
          </div>
          <span className="text-xs text-[#53634F] font-medium flex items-center mt-2 gap-1">
            Net profit
          </span>
        </div>

        <div className="bg-[#FAF7F2] p-6 rounded-2xl border border-[#E3DDD3] shadow-sm hover:border-[#53634F]/40 transition-all">
          <div className="flex justify-between items-center text-[#6C7B67] mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest">Dispatches & Orders</span>
            <span className="p-2 rounded-full bg-[#E7ECE4] text-[#53634F]">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="font-editorial text-3xl font-medium text-[#2A3528]">
            {data.kpis.total_dispatches} Dispatches
          </div>
          <span className="text-xs text-[#6C7B67] font-medium flex items-center mt-2 gap-1">
            {data.kpis.total_orders} Total Orders Active
          </span>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6C7B67]">Operations</span>
          <h2 className="font-editorial text-2xl text-[#2A3528]">Role Dashboards</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_DASHBOARDS.map(({ id, title, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="group flex min-h-24 items-center justify-between gap-4 border border-[#E3DDD3] bg-[#FAF7F2] px-4 py-4 text-left transition hover:border-[#8E9F8A] hover:bg-white"
            >
              <span className="flex min-w-0 items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#53634F]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#2A3528]">{title}</span>
                  <span className="mt-1 block text-xs text-[#6C7B67]">{description}</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#6C7B67] transition group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-8 border-t border-[#E3DDD3] pt-6 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6C7B67]">Recorded cash & payroll</span>
          <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Buyer Receipts', data.kpis.buyer_payments_received],
              ['Buyer Balance', data.kpis.buyer_receivables],
              ['Supplier Paid', data.kpis.supplier_payments_paid],
              ['Wages Paid', data.kpis.worker_wages_paid],
            ].map(([label, amount]) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-wider text-[#6C7B67]">{label}</div>
                <div className="mt-1 font-editorial text-2xl text-[#2A3528]">₹{Number(amount || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#8B7963]">Machine & power remains estimated until meter/utility bills are entered.</p>
        </div>
        <button type="button" onClick={() => setActiveTab('accounting')} className="inline-flex h-fit items-center justify-center gap-2 rounded-full border border-[#53634F] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#53634F] hover:bg-[#E7ECE4]">
          <ReceiptText className="h-4 w-4" />
          Payroll & settlements
        </button>
      </section>

      {/* Analytics Charts with Sage & Linen Theme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue vs Cost Bar Chart */}
        <div className="lg:col-span-2 bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#E3DDD3] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block">Performance Analytics</span>
              <h3 className="font-editorial text-xl sm:text-2xl text-[#2A3528]">Revenue vs Operating Expense</h3>
            </div>
            <span className="text-xs text-[#53634F] font-medium bg-[#E7ECE4] px-3 py-1 rounded-full border border-[#D1DBD0]">
              FY 2026-27
            </span>
          </div>
          <p className="text-xs text-[#6C7B67] mb-6 font-light">Visual trend of manufacturing billing versus spinning & weaving expenses</p>
          
          {hasMonthlyData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_trends}>
                  <XAxis dataKey="month" stroke="#8E9F8A" tick={{ fill: '#6C7B67', fontSize: 12 }} />
                  <YAxis stroke="#8E9F8A" tick={{ fill: '#6C7B67', fontSize: 11 }} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#E3DDD3', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    formatter={(value) => `₹${value.toLocaleString()}`} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <Bar dataKey="revenue" name="Gross Revenue" fill="#53634F" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Operating Costs" fill="#C27D60" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit" fill="#BFA882" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center border-y border-dashed border-[#DDD4C7] text-sm text-[#6C7B67]">
              No dispatch or cost records for these months.
            </div>
          )}
        </div>

        {/* Cost Breakdown Pie Chart */}
        <div className="bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#E3DDD3] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">Expenditure Split</span>
            <h3 className="font-editorial text-xl sm:text-2xl text-[#2A3528] mb-1">Factory Cost Breakdown</h3>
            <p className="text-xs text-[#6C7B67] mb-4 font-light">Raw material yarn vs labor wages vs machine electricity</p>
            
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.cost_breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.cost_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#E3DDD3', borderRadius: '12px' }}
                    formatter={(value) => `₹${value.toLocaleString()}`} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs border-t border-[#E3DDD3] pt-4">
            {data.cost_breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS[idx % THEME_COLORS.length] }} />
                  <span className="text-[#2A3528] font-medium">{item.name}</span>
                </span>
                <span className="font-mono text-[#53634F] font-semibold">₹{item.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
