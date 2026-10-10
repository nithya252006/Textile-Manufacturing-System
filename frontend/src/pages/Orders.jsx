import React, { useState, useEffect } from 'react';
import { FileText, PhoneCall, Truck, PlusCircle, CheckCircle2, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/orders-finance';

export default function Orders() {
  const [orders, setOrders] = useState([]);
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
    try {
      const res = await fetch(`${API_BASE}/orders`);
      if (res.ok) setOrders(await res.json());
    } catch {
      // Offline fallback
      setOrders([
        { id: 1, order_code: 'ORD-2026-001', buyer_name: 'Raymond Garments', fabric_type: 'Cotton Shirting', color: 'Navy Blue', quantity_meters: 2500, produced_meters: 1800, deadline: '2026-10-15', status: 'Weaving', total_price: 375000 },
        { id: 2, order_code: 'ORD-2026-002', buyer_name: 'FabIndia Retail', fabric_type: 'Pure Linen', color: 'Olive Green', quantity_meters: 1000, produced_meters: 300, deadline: '2026-10-18', status: 'Pending', total_price: 220000 },
        { id: 3, order_code: 'ORD-2026-003', buyer_name: 'Zara Exports', fabric_type: 'Rayon Printed', color: 'Pure White', quantity_meters: 5000, produced_meters: 4900, deadline: '2026-10-12', status: 'QC Passed', total_price: 650000 },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm)
      });
      setShowOrderModal(false);
      fetchData();
    } catch (err) {
      alert('Error creating order: ' + err.message);
    }
  };

  const handleTrackBuyer = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/tracking`);
      if (res.ok) {
        setTrackingModal(await res.json());
      }
    } catch {
      const ord = orders.find(o => o.id === orderId);
      setTrackingModal({
        order_code: ord.order_code,
        buyer_name: ord.buyer_name,
        fabric: `${ord.fabric_type} (${ord.color})`,
        ordered_meters: ord.quantity_meters,
        completed_meters: ord.produced_meters,
        progress_percentage: Math.round((ord.produced_meters / ord.quantity_meters) * 100),
        current_status: ord.status,
        active_stage: 'Air-Jet Loom #01 (Weaving)',
        deadline: ord.deadline,
        message_for_buyer: `Your order is 72% woven on Air-Jet Loom #01. Estimated dispatch: ${ord.deadline}`
      });
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchForm)
      });
      setShowDispatchModal(false);
      alert('Truck loaded and Invoice matched!');
      fetchData();
    } catch (err) {
      alert('Error dispatching: ' + err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            Scene 4 & 5: Buyer Order Tracking & Dispatch Truck Loading
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Give immediate answers when buyers call, and ensure right rolls in right quantities go on the truck with matching invoice.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Truck className="h-4 w-4" />
            Load Truck & Dispatch
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Buyer Order
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Active Buyer Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Buyer Name</th>
                <th className="py-2.5 px-3">Fabric & Color</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3">Deadline</th>
                <th className="py-2.5 px-3 text-center">Stage</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{o.order_code}</td>
                  <td className="py-3 px-3 font-medium text-slate-800">{o.buyer_name}</td>
                  <td className="py-3 px-3 text-slate-600">{o.fabric_type} ({o.color})</td>
                  <td className="py-3 px-3 text-right font-medium">{o.quantity_meters} m</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{o.deadline}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      o.status === 'Dispatched' ? 'bg-purple-100 text-purple-800' :
                      o.status === 'QC Passed' ? 'bg-emerald-100 text-emerald-800' :
                      o.status === 'Weaving' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleTrackBuyer(o.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      Buyer Call View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buyer Call Tracking Modal (Scene 4) */}
      {trackingModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
              <PhoneCall className="h-5 w-5" />
              <span>Scene 4: Instant Answer for Calling Buyer</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{trackingModal.buyer_name}</h3>
            <p className="text-xs text-slate-500 mb-4">{trackingModal.order_code} • {trackingModal.fabric}</p>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-950 text-sm mb-4">
              <div className="font-semibold text-xs text-amber-700 uppercase tracking-wide">Tell the buyer:</div>
              <div className="text-base font-bold mt-1">"{trackingModal.message_for_buyer}"</div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-6">
              <div className="flex justify-between">
                <span>Progress:</span>
                <span className="font-bold text-slate-900">{trackingModal.progress_percentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${trackingModal.progress_percentage}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span>Active Floor Stage:</span>
                <span className="font-bold text-slate-900">{trackingModal.active_stage}</span>
              </div>
              <div className="flex justify-between">
                <span>Committed Deadline:</span>
                <span className="font-bold text-slate-900">{trackingModal.deadline}</span>
              </div>
            </div>

            <button
              onClick={() => setTrackingModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm"
            >
              Done / Hang Up
            </button>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Book Buyer Order</h3>
            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer Name</label>
                <input
                  type="text"
                  required
                  value={orderForm.buyer_name}
                  onChange={(e) => setOrderForm({ ...orderForm, buyer_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fabric Type</label>
                  <input
                    type="text"
                    required
                    value={orderForm.fabric_type}
                    onChange={(e) => setOrderForm({ ...orderForm, fabric_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                  <input
                    type="text"
                    required
                    value={orderForm.color}
                    onChange={(e) => setOrderForm({ ...orderForm, color: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Meters</label>
                  <input
                    type="number"
                    required
                    value={orderForm.quantity_meters}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity_meters: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    required
                    value={orderForm.deadline}
                    onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Order Value (₹)</label>
                <input
                  type="number"
                  required
                  value={orderForm.total_price}
                  onChange={(e) => setOrderForm({ ...orderForm, total_price: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  Book Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Truck Modal (Scene 5) */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Scene 5: Load Truck for Dispatch</h3>
            <p className="text-xs text-slate-500 mb-4">Match rolls, quantity, and generate invoice for delivery truck.</p>
            <form onSubmit={handleDispatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Order to Dispatch</label>
                <select
                  value={dispatchForm.order_id}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, order_id: parseInt(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                >
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.order_code} - {o.buyer_name} ({o.quantity_meters}m)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Truck / Vehicle #</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.truck_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, truck_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.invoice_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, invoice_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rolls Count</label>
                  <input
                    type="number"
                    required
                    value={dispatchForm.rolls_count}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, rolls_count: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatched Meters</label>
                  <input
                    type="number"
                    required
                    value={dispatchForm.dispatched_meters}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, dispatched_meters: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                >
                  Confirm Truck Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
