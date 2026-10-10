import React from 'react';
import { Layers, ShieldCheck, Truck, BarChart2, LogOut, ReceiptText } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onLogout }) {
  const tabs = [
    { id: 'dashboard', label: 'Owner Overview', role: 'Executive', icon: BarChart2 },
    { id: 'inventory', label: 'Yarn & Raw Store', role: 'Store Keeper', icon: Layers },
    { id: 'production', label: 'Floor & Quality QC', role: 'Floor Supervisor', icon: ShieldCheck },
    { id: 'orders', label: 'Orders & Logistics', role: 'Dispatch Head', icon: Truck },
    { id: 'accounting', label: 'Payroll & Settlements', role: 'Owner', icon: ReceiptText },
  ];

  const visibleTabs = tabs.filter((tab) => {
    if (!user?.role) return true;
    if (user.role === 'owner') return true;
    if (user.role === 'store_keeper') return ['dashboard', 'inventory'].includes(tab.id);
    if (user.role === 'floor_supervisor') return ['dashboard', 'production'].includes(tab.id);
    if (user.role === 'buyer' || user.role === 'dispatch') return ['dashboard', 'orders'].includes(tab.id);
    return true;
  });

  const dashboardLabels = {
    owner: 'Owner Overview',
    store_keeper: 'Store Overview',
    floor_supervisor: 'Floor Overview',
    dispatch: 'Dispatch Overview',
    buyer: 'Buyer Overview',
  };

  return (
    <header className="sticky top-0 z-50 bg-[#F7F4EE]/95 backdrop-blur-md border-b border-[#E3DDD3] transition-all">
      <div className="bg-[#42503F] text-[#F7F4EE] text-[11px] tracking-[0.2em] uppercase py-1.5 px-4 text-center font-medium">
        <span>✦ Sustainable Organic Weaving • Zero-Defect Manufacturing Backbone • Est. 1994 ✦</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 border-b border-[#EBE5DB] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-xs tracking-widest uppercase text-[#6C7B67]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#53634F] inline-block animate-pulse"></span>
              Live Mill Telemetry
            </span>
            <span className="text-[#C9BFAF]">/</span>
            <span className="text-[#53634F] font-semibold">Tiruppur Hub #04</span>
          </div>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer text-center group flex flex-col items-center"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#6C7B67] font-semibold block mb-0.5">
              Organic & Industrial Mill
            </span>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-3xl md:text-4xl tracking-tight text-[#2A3528] lowercase font-normal">
                everest <span className="font-editorial text-[#53634F]">mills</span>
              </span>
              <span className="text-[#53634F] text-xs">✦</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[#E3DDD3] bg-[#FAF7F2] px-3 py-2 text-left">
              <div className="text-[9px] uppercase tracking-[0.22em] text-[#6C7B67]">Signed in</div>
              <div className="text-sm font-medium text-[#2A3528]">{user?.name || 'User'}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-full border border-[#E3DDD3] bg-[#EFEAE0] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2A3528] transition hover:bg-[#E7E1D8]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>

        <nav className="flex items-center justify-center space-x-1 sm:space-x-6 py-2.5 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const label = tab.id === 'dashboard' ? dashboardLabels[user?.role] || tab.label : tab.label;
            const labelOverrides = {
              buyer: { orders: { label: 'My Orders', role: 'Buyer' } },
              dispatch: { orders: { label: 'Dispatch Desk', role: 'Dispatch' } },
            };
            const override = labelOverrides[user?.role]?.[tab.id];
            const roleLabel = tab.id === 'dashboard'
              ? user?.role?.replaceAll('_', ' ') || tab.role
              : override?.role || tab.role;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 text-xs md:text-sm tracking-wider uppercase transition-all duration-200 flex items-center gap-2 rounded-full whitespace-nowrap ${
                  isActive
                    ? 'bg-[#53634F] text-[#FAF7F2] font-semibold shadow-sm'
                    : 'text-[#5A6856] hover:text-[#2A3528] hover:bg-[#EFEAE0]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FAF7F2]' : 'text-[#6C7B67]'}`} />
                <span>{override?.label || label}</span>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full tracking-normal uppercase ${
                    isActive
                      ? 'bg-[#42503F] text-[#DDD4C7]'
                      : 'bg-[#E7ECE4] text-[#53634F]'
                  }`}
                >
                  {roleLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
