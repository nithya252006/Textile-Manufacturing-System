import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Clock3, Factory, Layers, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { API_BASE, authFetch } from '../api';

const ROLE_CONTENT = {
  store_keeper: {
    title: 'Store Room Overview',
    subtitle: 'Yarn availability, low-stock alerts, and incoming material activity.',
    section: 'Yarn & Raw Store',
    icon: Layers,
  },
  floor_supervisor: {
    title: 'Production Floor Overview',
    subtitle: 'Machine readiness, shift output, and pending quality inspections.',
    section: 'Floor & Quality QC',
    icon: Factory,
  },
  dispatch: {
    title: 'Dispatch Desk Overview',
    subtitle: 'Open commitments, available finished rolls, and completed shipments.',
    section: 'Orders & Logistics',
    icon: Truck,
  },
  buyer: {
    title: 'Buyer Order Overview',
    subtitle: 'Progress and delivery deadlines for your mill orders.',
    section: 'My Orders',
    icon: PackageCheck,
  },
};

const emptyData = {
  stocks: [],
  alerts: [],
  machines: [],
  rolls: [],
  orders: [],
  dispatches: [],
  floorSummary: {},
  qcSummary: {},
};

async function getApiJson(url) {
  const response = await authFetch(`${API_BASE}${url}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed (HTTP ${response.status})`);
  }
  return payload;
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="border-y border-[#E3DDD3] py-4">
      <div className="flex items-center justify-between gap-2 text-[#6C7B67]">
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
        <Icon className="h-4 w-4 text-[#53634F]" />
      </div>
      <div className="mt-2 font-editorial text-3xl text-[#2A3528]">{value}</div>
      {detail && <div className="mt-1 text-xs text-[#6C7B67]">{detail}</div>}
    </div>
  );
}

function SectionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-[#53634F] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF7F2] transition hover:bg-[#42503F]"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

export default function RoleDashboard({ user, dashboardRole, setActiveTab }) {
  const role = dashboardRole || user?.role;
  const roleContent = ROLE_CONTENT[role] || ROLE_CONTENT.floor_supervisor;
  const content = user?.role === 'owner' && role === 'buyer'
    ? { ...roleContent, title: 'Buyer Portfolio Overview', section: 'Buyer Portfolio' }
    : roleContent;
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        let result = emptyData;
        if (role === 'store_keeper') {
          const [stocks, alerts] = await Promise.all([
            getApiJson('/api/inventory/yarn'),
            getApiJson('/api/inventory/alerts'),
          ]);
          result = { ...emptyData, stocks, alerts };
        } else if (role === 'floor_supervisor') {
          const [floor, quality] = await Promise.all([
            getApiJson('/api/production/machines'),
            getApiJson('/api/production/qc/rolls'),
          ]);
          result = {
            ...emptyData,
            machines: floor.machines || [],
            floorSummary: floor.floor_summary || {},
            rolls: quality.rolls || [],
            qcSummary: quality.qc_summary || {},
          };
        } else if (role === 'dispatch') {
          const [orders, rolls, dispatches] = await Promise.all([
            getApiJson('/api/orders-finance/orders'),
            getApiJson('/api/orders-finance/available-rolls'),
            getApiJson('/api/orders-finance/dispatches'),
          ]);
          result = { ...emptyData, orders, rolls, dispatches };
        } else if (role === 'buyer') {
          const endpoint = user.role === 'owner'
            ? '/api/orders-finance/orders'
            : '/api/orders-finance/my-orders';
          const orders = await getApiJson(endpoint);
          result = { ...emptyData, orders };
        }

        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load this dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();
    return () => { cancelled = true; };
  }, [role, user.role]);

  const Icon = content.icon;
  const totalYarn = data.stocks.reduce((total, stock) => total + (stock.quantity_kg || 0), 0);
  const pendingQc = data.rolls.filter((roll) => roll.qc_status === 'Pending').length;
  const openOrders = data.orders.filter((order) => order.status !== 'Dispatched');
  const availableMeters = data.rolls.reduce((total, roll) => total + (roll.meters || 0), 0);
  const shippedOrders = data.orders.filter((order) => order.status === 'Dispatched').length;
  const activeBuyerOrders = data.orders.filter((order) => order.status !== 'Dispatched');
  const completedBuyerMeters = data.orders.reduce((total, order) => total + (order.completed_meters || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
      <header className="border-b border-[#DCD5CA] pb-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6C7B67]">
              <Icon className="h-4 w-4 text-[#53634F]" />
              <span>{content.section}</span>
            </div>
            <h1 className="font-editorial text-3xl text-[#2A3528] sm:text-4xl">{content.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#6C7B67]">{content.subtitle}</p>
          </div>
          <div className="text-right text-xs text-[#6C7B67]">
            <div className="font-semibold text-[#2A3528]">{user?.name}</div>
            <div>{content.section}</div>
            {user?.role === 'owner' && (
              <button type="button" onClick={() => setActiveTab('dashboard')} className="mt-2 font-semibold text-[#53634F] underline underline-offset-4">
                Return to Owner Overview
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 border-l-4 border-[#C27D60] bg-[#F5ECE8] px-4 py-3 text-sm text-[#7A3F2A]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="border-y border-[#E3DDD3] py-12 text-center text-sm text-[#6C7B67]">Loading section overview…</div>
      ) : (
        <>
          {role === 'store_keeper' && (
            <>
              <section className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <Metric label="Yarn Lots" value={data.stocks.length} detail="Registered in store" icon={Layers} />
                <Metric label="Available Yarn" value={`${totalYarn.toLocaleString()} kg`} detail="Across all lots" icon={PackageCheck} />
                <Metric label="Low Stock Alerts" value={data.alerts.length} detail="At or below threshold" icon={AlertTriangle} />
              </section>
              <section className="grid gap-8 border-t border-[#E3DDD3] pt-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="font-editorial text-xl text-[#2A3528]">Stock requiring attention</h2>
                  {data.alerts.length ? (
                    <ul className="mt-4 divide-y divide-[#E3DDD3]">
                      {data.alerts.slice(0, 4).map((alert) => (
                        <li key={alert.id} className="flex gap-3 py-3 text-sm text-[#6C7B67]">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C27D60]" />
                          <span>{alert.alert}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-[#6C7B67]">No yarn lots are below their threshold.</p>}
                </div>
                <div className="self-center"><SectionButton onClick={() => setActiveTab('inventory')}>Open inventory</SectionButton></div>
              </section>
            </>
          )}

          {role === 'floor_supervisor' && (
            <>
              <section className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Running Machines" value={data.floorSummary.running || 0} detail={`${data.floorSummary.total_output_today || 0} m output today`} icon={Activity} />
                <Metric label="Idle Machines" value={data.floorSummary.idle || 0} detail={`${data.machines.length} units registered`} icon={Factory} />
                <Metric label="Breakdowns" value={data.floorSummary.breakdown || 0} detail="Machines requiring attention" icon={AlertTriangle} />
                <Metric label="QC Pass Rate" value={`${data.qcSummary.pass_rate || 0}%`} detail={`${pendingQc} pending QC slips`} icon={ShieldCheck} />
              </section>
              <section className="grid gap-8 border-t border-[#E3DDD3] pt-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="font-editorial text-xl text-[#2A3528]">Current machine floor</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.machines.slice(0, 6).map((machine) => (
                      <div key={machine.id} className="flex items-center justify-between border-b border-[#E3DDD3] py-2 text-sm">
                        <span className="text-[#2A3528]">{machine.name}</span>
                        <span className="text-xs text-[#6C7B67]">{machine.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="self-center"><SectionButton onClick={() => setActiveTab('production')}>Open production</SectionButton></div>
              </section>
            </>
          )}

          {role === 'dispatch' && (
            <>
              <section className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Open Orders" value={openOrders.length} detail="Not fully dispatched" icon={Clock3} />
                <Metric label="Available Rolls" value={data.rolls.length} detail={`${availableMeters.toLocaleString()} m QC-passed`} icon={PackageCheck} />
                <Metric label="Shipped Orders" value={shippedOrders} detail="Completed contracts" icon={Truck} />
                <Metric label="Dispatches" value={data.dispatches.length} detail="Recorded shipments" icon={Layers} />
              </section>
              <section className="grid gap-8 border-t border-[#E3DDD3] pt-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="font-editorial text-xl text-[#2A3528]">Orders awaiting shipment</h2>
                  {openOrders.length ? (
                    <ul className="mt-3 divide-y divide-[#E3DDD3]">
                      {openOrders.slice(0, 5).map((order) => (
                        <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                          <span className="font-mono text-[#53634F]">{order.order_code}</span>
                          <span className="text-[#2A3528]">{order.buyer_name}</span>
                          <span className="text-xs text-[#6C7B67]">{order.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-[#6C7B67]">No open orders.</p>}
                </div>
                <div className="self-center"><SectionButton onClick={() => setActiveTab('orders')}>Open dispatch desk</SectionButton></div>
              </section>
            </>
          )}

          {role === 'buyer' && (
            <>
              <section className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <Metric label="My Orders" value={data.orders.length} detail="Contracts with Everest Mills" icon={PackageCheck} />
                <Metric label="In Production" value={activeBuyerOrders.length} detail="Orders not yet dispatched" icon={Factory} />
                <Metric label="QC-Passed Fabric" value={`${completedBuyerMeters.toLocaleString()} m`} detail="Across your orders" icon={ShieldCheck} />
              </section>
              <section className="border-t border-[#E3DDD3] pt-6">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2 className="font-editorial text-xl text-[#2A3528]">Order progress</h2>
                  <SectionButton onClick={() => setActiveTab('orders')}>View my orders</SectionButton>
                </div>
                {data.orders.length ? (
                  <ul className="divide-y divide-[#E3DDD3]">
                    {data.orders.map((order) => (
                      <li key={order.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-sm text-[#53634F]">{order.order_code}</span>
                            <span className="text-sm text-[#2A3528]">{order.fabric_type} · {order.color}</span>
                            <span className="text-xs text-[#6C7B67]">{order.status}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden bg-[#E7E2D8]">
                            <div className="h-full bg-[#53634F]" style={{ width: `${Math.min(order.progress_percentage || 0, 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-xs text-[#6C7B67] sm:text-right">
                          <div>{order.completed_meters || 0} / {order.quantity_meters} m</div>
                          <div>Due {order.deadline}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="border-y border-[#E3DDD3] py-8 text-center text-sm text-[#6C7B67]">No orders are linked to this buyer account yet.</p>}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
