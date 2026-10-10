import React, { useState, useEffect } from 'react';
import { FileText, PhoneCall, Truck, PlusCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { API_BASE, authFetch } from '../api';

export default function Orders({ user }) {
  const [orders, setOrders] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [orderError, setOrderError] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(null);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [selectedRollIds, setSelectedRollIds] = useState([]);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [trackingModal, setTrackingModal] = useState(null);

  // New Order Form
  const [orderForm, setOrderForm] = useState({
    buyer_name: 'FabIndia Retail',
    fabric_type: 'Cotton Shirting',
    color: 'Navy Blue',
    quantity_meters: 1500,
    deadline: '2026-10-25',
    total_price: 240000
  });

  // Dispatch Form
  const [dispatchForm, setDispatchForm] = useState({
    order_id: 1,
    truck_number: 'TN-38-AX-9941',
    invoice_number: 'INV-2026-881',
    rolls_count: 15,
    dispatched_meters: 1800
  });

  const fetchData = async () => {
    setPageError(null);
    try {
      const endpoint = user?.role === 'buyer'
        ? `${API_BASE}/api/orders-finance/my-orders`
        : `${API_BASE}/api/orders-finance/orders`;

      const res = await authFetch(endpoint);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(err.detail || `HTTP ${res.status} loading orders`);
        return;
      }
      const data = await res.json();
      setOrders(data);
      if (data.length > 0 && !dispatchForm.order_id) {
        setDispatchForm(prev => ({ ...prev, order_id: data[0].id }));
      }
      setIsOffline(false);
    } catch {
      // Offline fallback only on network error
      setIsOffline(true);
      setOrders([
        { id: 1, order_code: 'ORD-2026-001', buyer_name: 'Raymond Garments', fabric_type: 'Cotton Shirting', color: 'Navy Blue', quantity_meters: 2500, produced_meters: 1800, completed_meters: 120, progress_percentage: 4.8, deadline: '2026-10-15', status: 'Weaving', total_price: 375000 },
        { id: 2, order_code: 'ORD-2026-002', buyer_name: 'FabIndia Retail', fabric_type: 'Pure Linen', color: 'Olive Green', quantity_meters: 1000, produced_meters: 300, completed_meters: 0, progress_percentage: 0, deadline: '2026-10-18', status: 'Pending', total_price: 220000 },
        { id: 3, order_code: 'ORD-2026-003', buyer_name: 'Zara Exports', fabric_type: 'Rayon Printed', color: 'Pure White', quantity_meters: 5000, produced_meters: 4900, completed_meters: 150, progress_percentage: 3, deadline: '2026-10-12', status: 'QC Passed', total_price: 650000 },
      ]);
    }
  };

  const fetchAvailableRolls = async (orderId) => {
    setDispatchError(null);
    setSelectedRollIds([]);
    setAvailableRolls([]);
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/available-rolls?order_id=${orderId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDispatchError(data.detail || `Could not load available rolls (HTTP ${res.status})`);
        return;
      }
      setAvailableRolls(data);
    } catch (err) {
      setDispatchError(`Network connection error: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.role, user?.id]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setOrderError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setOrderError(err.detail || `Order booking rejected (HTTP ${res.status})`);
        return;
      }
      setShowOrderModal(false);
      fetchData();
    } catch (err) {
      setOrderError('Network connection error: ' + err.message);
    }
  };

  const handleTrackBuyer = async (orderId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/orders/${orderId}/tracking`);
      if (res.ok) {
        setTrackingModal(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || `Could not load tracking for order #${orderId}`);
      }
    } catch {
      const ord = orders.find(o => o.id === orderId);
      if (ord) {
        const completedMeters = ord.completed_meters ?? ord.produced_meters;
        const progressPercentage = ord.progress_percentage ?? Math.round((completedMeters / ord.quantity_meters) * 100);
        setTrackingModal({
          order_code: ord.order_code,
          buyer_name: ord.buyer_name,
          fabric: `${ord.fabric_type} (${ord.color})`,
          ordered_meters: ord.quantity_meters,
          completed_meters: completedMeters,
          progress_percentage: progressPercentage,
          current_status: ord.status,
          active_stage: 'Air-Jet Loom #01 (Weaving)',
          deadline: ord.deadline,
          message_for_buyer: `Your order is ${progressPercentage}% complete based on QC-passed fabric (${completedMeters}m). Estimated dispatch: ${ord.deadline}`
        });
      }
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    setDispatchError(null);
    setDispatchSuccess(null);
    if (selectedRollIds.length === 0) {
      setDispatchError('Select at least one available QC-passed roll.');
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: dispatchForm.order_id,
          truck_number: dispatchForm.truck_number,
          invoice_number: dispatchForm.invoice_number,
          roll_ids: selectedRollIds,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDispatchError(err.detail || `Dispatch failed (HTTP ${res.status})`);
        return;
      }
      setShowDispatchModal(false);
      setSelectedRollIds([]);
      setDispatchSuccess('Truck loaded and Tax Invoice generated successfully!');
      fetchData();
      setTimeout(() => setDispatchSuccess(null), 5000);
    } catch (err) {
      setDispatchError('Network connection error: ' + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#E3DDD3] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-script text-2xl text-[#53634F]">buyer commitments & logistics</span>
            <span className="text-[#6C7B67] text-xs">✦</span>
            {isOffline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF3F0] text-[#C27D60] border border-[#EACFC5]">
                Offline demo data
              </span>
            )}
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl text-[#2A3528] font-normal flex items-center gap-3">
            <FileText className="h-6 w-6 text-[#53634F]" />
            Buyer Order Pipeline & Truck Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-[#6C7B67] mt-1 font-light max-w-xl">
            Real-time status updates for calling brand accounts and verified roll manifests for delivery dispatches.
          </p>
          {pageError && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#FAF3F0] border border-[#EACFC5] text-xs text-[#C27D60] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{pageError}</span>
            </div>
          )}
          {dispatchSuccess && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#E7ECE4] border border-[#D1DBD0] text-xs text-[#53634F] flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>{dispatchSuccess}</span>
            </div>
          )}
        </div>
        {['owner', 'dispatch'].includes(user?.role) && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowDispatchModal(true);
                fetchAvailableRolls(dispatchForm.order_id);
              }}
              className="flex items-center gap-2 bg-[#DDD4C7] hover:bg-[#D0C5B5] text-[#2A3528] font-semibold px-5 py-3 rounded-full text-xs uppercase tracking-widest transition-all shadow-xs cursor-pointer"
            >
              <Truck className="h-4 w-4 text-[#53634F]" />
              <span>Load Truck & Invoice</span>
            </button>
            <button
              onClick={() => { setShowOrderModal(true); setOrderError(null); }}
              className="flex items-center gap-2 bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] font-semibold px-5 py-3 rounded-full text-xs uppercase tracking-widest shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Buyer Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-[#FAF7F2] p-6 sm:p-7 rounded-3xl shadow-sm border border-[#E3DDD3]">
        <div className="flex justify-between items-center mb-5">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">Order Registry</span>
            <h2 className="font-editorial text-xl sm:text-2xl text-[#2A3528]">Active Client Purchase Orders</h2>
          </div>
          <span className="text-xs bg-[#E7ECE4] text-[#53634F] px-3 py-1 rounded-full font-medium">
            {orders.length} Contracts Processing
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#EFEAE0] text-[#6C7B67] text-[11px] uppercase tracking-wider border-b border-[#E3DDD3]">
              <tr>
                <th className="py-3 px-3">Order #</th>
                <th className="py-3 px-3">Buyer Name</th>
                <th className="py-3 px-3">Fabric & Color</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3">Deadline</th>
                <th className="py-3 px-3 text-center">Stage</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBE5DB]">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#F3EFE7] transition-colors">
                  <td className="py-3 px-3 font-mono font-medium text-[#2A3528] text-xs">{o.order_code}</td>
                  <td className="py-3 px-3 font-medium text-[#2A3528]">{o.buyer_name}</td>
                  <td className="py-3 px-3 text-[#53634F]">{o.fabric_type} ({o.color})</td>
                  <td className="py-3 px-3 text-right font-medium text-[#2A3528]">{o.quantity_meters} m</td>
                  <td className="py-3 px-3 text-[#6C7B67] text-xs font-mono">{o.deadline}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      o.status === 'Dispatched' ? 'bg-[#EFEAE0] text-[#6C7B67] border border-[#DDD4C7]' :
                      o.status === 'QC Passed' ? 'bg-[#E7ECE4] text-[#53634F] border border-[#D1DBD0]' :
                      o.status === 'Weaving' ? 'bg-[#EDF2EC] text-[#364433] border border-[#B0BFAE]' : 
                      'bg-[#FAF1EE] text-[#C27D60] border border-[#EACFC5]'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleTrackBuyer(o.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#DDD4C7] hover:bg-[#D0C5B5] text-[#2A3528] font-semibold rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                    >
                      <PhoneCall className="h-3 w-3 text-[#53634F]" />
                      <span>Buyer Call</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buyer Call Tracking Modal */}
      {trackingModal && (
        <div className="fixed inset-0 bg-[#2A3528]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#DDD4C7]">
            <div className="flex items-center gap-2 text-[#53634F] font-semibold text-xs uppercase tracking-wider mb-1">
              <PhoneCall className="h-4 w-4" />
              <span>Instant Telephony Answer</span>
            </div>
            <h3 className="font-editorial text-2xl sm:text-3xl text-[#2A3528]">{trackingModal.buyer_name}</h3>
            <p className="text-xs text-[#6C7B67] mb-5">{trackingModal.order_code} • {trackingModal.fabric}</p>

            <div className="bg-[#EDF2EC] border border-[#B0BFAE] p-5 rounded-2xl text-[#2B3B28] text-xs mb-5">
              <div className="font-semibold text-[10px] uppercase tracking-widest text-[#53634F] mb-1">Suggested Operator Script:</div>
              <div className="font-editorial text-lg text-[#2A3528] italic">"{trackingModal.message_for_buyer}"</div>
            </div>

            <div className="space-y-3 text-xs text-[#6C7B67] mb-6">
              <div className="flex justify-between">
                <span>Production Progress:</span>
                <span className="font-mono font-bold text-[#2A3528]">{trackingModal.progress_percentage}%</span>
              </div>
              <div className="w-full bg-[#EFEAE0] rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#53634F] h-2.5 rounded-full transition-all"
                  style={{ width: `${trackingModal.progress_percentage}%` }}
                />
              </div>
              <div className="flex justify-between pt-1">
                <span>Active Floor Stage:</span>
                <span className="font-medium text-[#2A3528]">{trackingModal.active_stage}</span>
              </div>
              <div className="flex justify-between">
                <span>Committed Dispatch:</span>
                <span className="font-mono font-medium text-[#2A3528]">{trackingModal.deadline}</span>
              </div>
            </div>

            <button
              onClick={() => setTrackingModal(null)}
              className="w-full bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] font-semibold py-3 rounded-full text-xs uppercase tracking-widest cursor-pointer transition-colors"
            >
              Close Inquiry
            </button>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-[#2A3528]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#DDD4C7]">
            <h3 className="font-editorial text-2xl text-[#2A3528] mb-1">Book Buyer Order</h3>
            <p className="text-xs text-[#6C7B67] mb-4">Register new garment label fabric contract.</p>

            {orderError && (
              <div className="mb-4 p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{orderError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Buyer Name</label>
                <input
                  type="text"
                  required
                  value={orderForm.buyer_name}
                  onChange={(e) => setOrderForm({ ...orderForm, buyer_name: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Fabric Type</label>
                  <input
                    type="text"
                    required
                    value={orderForm.fabric_type}
                    onChange={(e) => setOrderForm({ ...orderForm, fabric_type: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Color</label>
                  <input
                    type="text"
                    required
                    value={orderForm.color}
                    onChange={(e) => setOrderForm({ ...orderForm, color: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Meters</label>
                  <input
                    type="number"
                    required
                    value={orderForm.quantity_meters}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity_meters: parseFloat(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Deadline</label>
                  <input
                    type="date"
                    required
                    value={orderForm.deadline}
                    onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Total Order Value (₹)</label>
                <input
                  type="number"
                  required
                  value={orderForm.total_price}
                  onChange={(e) => setOrderForm({ ...orderForm, total_price: parseFloat(e.target.value) })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DDD3]">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-5 py-2 text-xs uppercase tracking-wider font-semibold text-[#6C7B67] hover:bg-[#EFEAE0] rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs uppercase tracking-wider font-semibold bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] rounded-full shadow-sm"
                >
                  Book Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Truck Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-[#2A3528]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#DDD4C7]">
            <h3 className="font-editorial text-2xl text-[#2A3528] mb-1">Load Truck for Dispatch</h3>
            <p className="text-xs text-[#6C7B67] mb-4">Generate verified gate pass and invoice for departure.</p>

            {dispatchError && (
              <div className="mb-4 p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{dispatchError}</span>
              </div>
            )}

            <form onSubmit={handleDispatch} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Select Order to Dispatch</label>
                <select
                  value={dispatchForm.order_id}
                  onChange={(e) => {
                    const orderId = parseInt(e.target.value, 10);
                    setDispatchForm({ ...dispatchForm, order_id: orderId });
                    fetchAvailableRolls(orderId);
                  }}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                >
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.order_code} - {o.buyer_name} ({o.quantity_meters}m)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Truck Vehicle #</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.truck_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, truck_number: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.invoice_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, invoice_number: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67]">Available QC-Passed Rolls</label>
                  <span className="text-[11px] font-mono text-[#53634F]">{selectedRollIds.length} selected / {selectedRollIds.reduce((meters, id) => meters + (availableRolls.find((roll) => roll.id === id)?.meters || 0), 0)} m</span>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#DDD4C7] bg-white/70">
                  {availableRolls.length === 0 ? (
                    <p className="p-3 text-xs text-[#8A4E3B]">No undispatched QC-passed rolls are available for this order.</p>
                  ) : availableRolls.map((roll) => (
                    <label key={roll.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#EBE5DB] px-3 py-2 text-xs last:border-b-0 hover:bg-[#F3EFE7]">
                      <span className="flex items-center gap-2 text-[#2A3528]">
                        <input
                          type="checkbox"
                          checked={selectedRollIds.includes(roll.id)}
                          onChange={(event) => setSelectedRollIds((ids) => event.target.checked ? [...ids, roll.id] : ids.filter((id) => id !== roll.id))}
                          className="accent-[#53634F]"
                        />
                        <span className="font-mono">{roll.roll_code}</span>
                      </span>
                      <span className="font-mono text-[#6C7B67]">{roll.meters} m</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DDD3]">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-5 py-2 text-xs uppercase tracking-wider font-semibold text-[#6C7B67] hover:bg-[#EFEAE0] rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs uppercase tracking-wider font-semibold bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] rounded-full shadow-sm"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
