import React, { useState, useEffect } from 'react';
import { Truck, AlertTriangle, PlusCircle, CheckCircle2, Search, Layers, Sparkles, ClipboardList } from 'lucide-react';
import { API_BASE, authFetch } from '../api';

export default function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [addYarnError, setAddYarnError] = useState(null);
  const [checkMaterialError, setCheckMaterialError] = useState(null);
  const [reservationError, setReservationError] = useState(null);
  const [reservationSuccess, setReservationSuccess] = useState(null);
  const [reserveOrders, setReserveOrders] = useState([]);
  const [reserveOrderId, setReserveOrderId] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [checkForm, setCheckForm] = useState({ color: 'Navy Blue', meters: 2000 });
  const [checkResult, setCheckResult] = useState(null);

  // Form state
  const [newYarn, setNewYarn] = useState({
    material_name: 'Cotton 40s Combed',
    color: 'Navy Blue',
    lot_number: 'LOT-' + Math.floor(1000 + Math.random() * 9000),
    quantity_kg: 250,
    min_threshold_kg: 100,
    supplier_name: 'Coimbatore Cotton Mills',
    cost_per_kg: 275,
    supplier_invoice_number: '',
    supplier_bill_amount: ''
  });

  const fetchData = async () => {
    setPageError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/inventory/yarn`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(err.detail || `HTTP ${res.status} loading yarn stocks`);
        return;
      }
      const data = await res.json();
      setStocks(data);

      const alertRes = await authFetch(`${API_BASE}/api/inventory/alerts`);
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlerts(alertData);
      }
      setIsOffline(false);
    } catch {
      // Offline fallback only on network error
      setIsOffline(true);
      setStocks([
        { id: 1, material_name: 'Cotton 40s Combed', color: 'Navy Blue', lot_number: 'LOT-CB-401', quantity_kg: 450, min_threshold_kg: 150, supplier_name: 'Coimbatore Cotton Mills', is_low_stock: false },
        { id: 2, material_name: 'Polyester Spun 30s', color: 'Crimson Red', lot_number: 'LOT-PS-302', quantity_kg: 80, min_threshold_kg: 120, supplier_name: 'Surat Synthetic Ltd', is_low_stock: true },
        { id: 3, material_name: 'Viscose Rayon', color: 'Pure White', lot_number: 'LOT-VR-108', quantity_kg: 620, min_threshold_kg: 100, supplier_name: 'Grasim Fibres', is_low_stock: false },
        { id: 4, material_name: 'Linen Blend 20s', color: 'Olive Green', lot_number: 'LOT-LB-990', quantity_kg: 40, min_threshold_kg: 100, supplier_name: 'Kerala Flax Hub', is_low_stock: true },
      ]);
      setAlerts([
        { id: 2, alert: 'LOW STOCK: Polyester Spun 30s (Crimson Red) has only 80kg left!' },
        { id: 4, alert: 'LOW STOCK: Linen Blend 20s (Olive Green) has only 40kg left!' },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddYarn = async (e) => {
    e.preventDefault();
    setAddYarnError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/inventory/yarn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newYarn,
          quantity_kg: Number(newYarn.quantity_kg),
          min_threshold_kg: Number(newYarn.min_threshold_kg),
          cost_per_kg: Number(newYarn.cost_per_kg),
          supplier_invoice_number: newYarn.supplier_invoice_number.trim() || null,
          supplier_bill_amount: newYarn.supplier_bill_amount === '' ? null : Number(newYarn.supplier_bill_amount),
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddYarnError(err.detail || `Failed to record yarn lot (HTTP ${res.status})`);
        return;
      }
      setShowAddModal(false);
      setNewYarn({
        material_name: 'Cotton 40s Combed',
        color: 'Navy Blue',
        lot_number: 'LOT-' + Math.floor(1000 + Math.random() * 9000),
        quantity_kg: 250,
        min_threshold_kg: 100,
        supplier_name: 'Coimbatore Cotton Mills',
        cost_per_kg: 275,
        supplier_invoice_number: '',
        supplier_bill_amount: ''
      });
      fetchData();
    } catch (err) {
      setAddYarnError('Network connection error: ' + err.message);
    }
  };

  const openReserveModal = async () => {
    setReservationError(null);
    setReservationSuccess(null);
    setShowReserveModal(true);
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/orders`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReservationError(payload.detail || `Could not load orders (HTTP ${res.status})`);
        return;
      }
      setReserveOrders(payload.filter((order) => order.status !== 'Dispatched'));
      if (payload.length) setReserveOrderId(String(payload[0].id));
    } catch (err) {
      setReservationError(`Network connection error: ${err.message}`);
    }
  };

  const handleReserveYarn = async (event) => {
    event.preventDefault();
    setReservationError(null);
    setReservationSuccess(null);
    try {
      const res = await authFetch(`${API_BASE}/api/inventory/orders/${reserveOrderId}/reserve-yarn`, {
        method: 'POST',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReservationError(payload.detail || `Could not reserve yarn (HTTP ${res.status})`);
        return;
      }
      setReservationSuccess(`${payload.message}: ${payload.allocated_kg} kg allocated.`);
      await fetchData();
    } catch (err) {
      setReservationError(`Network connection error: ${err.message}`);
    }
  };

  const handleCheckMaterial = async (e) => {
    e.preventDefault();
    setCheckMaterialError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/inventory/check-material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabric_type: 'Fabric',
          color: checkForm.color,
          required_meters: parseFloat(checkForm.meters)
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCheckMaterialError(err.detail || `Check failed (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      setCheckResult(data);
    } catch {
      const reqKg = checkForm.meters * 0.3;
      setCheckResult({
        fabric_type: 'Fabric',
        color: checkForm.color,
        required_kg: reqKg,
        available_kg: 450,
        is_sufficient: 450 >= reqKg,
        action_needed: 450 >= reqKg ? 'Sufficient Yarn Available • Ready for Loom Warp' : 'Deficit Detected • Gate Intake Required'
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#E3DDD3] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-script text-2xl text-[#53634F]">raw materials & intake</span>
            <span className="text-[#6C7B67] text-xs">✦</span>
            {isOffline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF3F0] text-[#C27D60] border border-[#EACFC5]">
                Offline demo data
              </span>
            )}
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl text-[#2A3528] font-normal flex items-center gap-3">
            <Truck className="h-6 w-6 text-[#53634F]" />
            Yarn Inward Gate & Spindle Store
          </h1>
          <p className="text-xs sm:text-sm text-[#6C7B67] mt-1 font-light max-w-xl">
            Track inward cotton and linen bales, monitor critical threshold reserves, and verify pre-order material stock.
          </p>
          {pageError && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#FAF3F0] border border-[#EACFC5] text-xs text-[#C27D60] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{pageError}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openReserveModal}
            className="flex items-center gap-2 border border-[#53634F] bg-transparent px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#53634F] transition hover:bg-[#E7ECE4]"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Reserve for Order</span>
          </button>
          <button
            onClick={() => { setShowAddModal(true); setAddYarnError(null); }}
            className="flex items-center gap-2 bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] font-semibold px-5 py-3 rounded-full shadow-sm hover:shadow transition-all text-xs uppercase tracking-widest cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Log Incoming Truck</span>
          </button>
        </div>
      </div>

      {reservationSuccess && (
        <div className="flex items-center gap-2 border border-[#D1DBD0] bg-[#E7ECE4] px-4 py-3 text-sm text-[#53634F]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{reservationSuccess}</span>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-[#F5ECE8] border-l-4 border-[#C27D60] p-5 rounded-r-2xl space-y-2">
          <div className="flex items-center gap-2 text-[#9C5A40] font-semibold text-xs uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            <span>Low Stock Warning Threshold Triggered</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#7A3F2A]">
            {alerts.map((al, idx) => (
              <div key={idx} className="bg-white/80 px-3.5 py-2 rounded-xl border border-[#EACFC5] flex items-center gap-2">
                <span className="text-[#C27D60]">✦</span>
                <span>{al.alert || al}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Material Check & Stocks Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pre-Production Material Check */}
        <div className="bg-[#FAF7F2] p-6 sm:p-7 rounded-3xl shadow-sm border border-[#E3DDD3] space-y-5">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">Verification</span>
            <h2 className="font-editorial text-xl text-[#2A3528] flex items-center gap-2">
              <Search className="h-4 w-4 text-[#53634F]" />
              Pre-Order Material Check
            </h2>
          </div>
          <p className="text-xs text-[#6C7B67] font-light">
            Check if the mill has sufficient yarn in stock before accepting or starting a new buyer order.
          </p>
          {checkMaterialError && (
            <div className="p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{checkMaterialError}</span>
            </div>
          )}
          <form onSubmit={handleCheckMaterial} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67] mb-1.5">Color / Yarn Shade</label>
              <input
                type="text"
                value={checkForm.color}
                onChange={(e) => setCheckForm({ ...checkForm, color: e.target.value })}
                className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm text-[#2A3528] focus:outline-none focus:border-[#53634F]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67] mb-1.5">Order Quantity (Meters)</label>
              <input
                type="number"
                value={checkForm.meters}
                onChange={(e) => setCheckForm({ ...checkForm, meters: e.target.value })}
                className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm text-[#2A3528] focus:outline-none focus:border-[#53634F]"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#DDD4C7] hover:bg-[#D0C5B5] text-[#2A3528] font-semibold py-2.5 rounded-full text-xs uppercase tracking-widest transition-all cursor-pointer shadow-sm"
            >
              Verify Availability
            </button>
          </form>

          {checkResult && (
            <div className={`p-4 rounded-2xl border text-xs mt-3 ${
              checkResult.is_sufficient ? 'bg-[#EDF2EC] border-[#B0BFAE] text-[#2B3B28]' : 'bg-[#FAF1EE] border-[#EACFC5] text-[#7A3F2A]'
            }`}>
              <div className="font-semibold flex items-center gap-1.5 mb-1.5">
                {checkResult.is_sufficient ? <CheckCircle2 className="h-4 w-4 text-[#53634F]" /> : <AlertTriangle className="h-4 w-4 text-[#C27D60]" />}
                <span>{checkResult.action_needed}</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div>Required Yarn: <b>{checkResult.required_kg} kg</b></div>
                <div>Available Yarn: <b>{checkResult.available_kg} kg</b></div>
              </div>
            </div>
          )}
        </div>

        {/* Yarn Stock Table */}
        <div className="lg:col-span-2 bg-[#FAF7F2] p-6 sm:p-7 rounded-3xl shadow-sm border border-[#E3DDD3]">
          <div className="flex justify-between items-center mb-5">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">Spindle Store</span>
              <h2 className="font-editorial text-xl sm:text-2xl text-[#2A3528]">Current Raw Material Lots</h2>
            </div>
            <span className="text-xs bg-[#E7ECE4] text-[#53634F] px-3 py-1 rounded-full font-medium">
              {stocks.length} Lots in Store
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#EFEAE0] text-[#6C7B67] text-[11px] uppercase tracking-wider border-b border-[#E3DDD3]">
                <tr>
                  <th className="py-3 px-3">Lot #</th>
                  <th className="py-3 px-3">Yarn Material</th>
                  <th className="py-3 px-3">Color</th>
                  <th className="py-3 px-3 text-right">On Hand (kg)</th>
                  <th className="py-3 px-3 text-right">Reserved</th>
                  <th className="py-3 px-3 text-right">Free</th>
                  <th className="py-3 px-3">Order Allocation</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE5DB]">
                {stocks.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F3EFE7] transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-[#2A3528] text-xs">{item.lot_number}</td>
                    <td className="py-3 px-3 font-medium text-[#2A3528]">{item.material_name}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-[#EFEAE0] text-[#53634F] font-medium border border-[#DDD4C7]">
                        {item.color}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#2A3528]">{item.quantity_kg} kg</td>
                    <td className="py-3 px-3 text-right text-xs text-[#6C7B67]">{item.reserved_kg || 0} kg</td>
                    <td className="py-3 px-3 text-right font-semibold text-[#53634F]">{item.available_kg ?? item.quantity_kg} kg</td>
                    <td className="py-3 px-3 text-xs text-[#6C7B67]">
                      {(item.reservations || []).map((allocation) => `${allocation.order_code}: ${allocation.reserved_kg} kg (${allocation.status})`).join(', ') || 'Unallocated'}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#6C7B67]">{item.supplier_name}</td>
                    <td className="py-3 px-3 text-center">
                      {item.is_low_stock ? (
                        <span className="bg-[#F5ECE8] text-[#C27D60] text-xs px-2.5 py-0.5 rounded-full font-semibold border border-[#EACFC5]">
                          Low Stock
                        </span>
                      ) : (
                        <span className="bg-[#E7ECE4] text-[#53634F] text-xs px-2.5 py-0.5 rounded-full font-medium border border-[#D1DBD0]">
                          Sufficient
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gate Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#2A3528]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#DDD4C7]">
            <h3 className="font-editorial text-2xl text-[#2A3528] mb-1">Gate Entry: Yarn Arrival</h3>
            <p className="text-xs text-[#6C7B67] mb-4">Record inward supplier delivery into the mill storage database.</p>
            
            {addYarnError && (
              <div className="mb-4 p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{addYarnError}</span>
              </div>
            )}

            <form onSubmit={handleAddYarn} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Yarn Material Type</label>
                <input
                  type="text"
                  required
                  value={newYarn.material_name}
                  onChange={(e) => setNewYarn({ ...newYarn, material_name: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Color / Shade</label>
                  <input
                    type="text"
                    required
                    value={newYarn.color}
                    onChange={(e) => setNewYarn({ ...newYarn, color: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Lot Number</label>
                  <input
                    type="text"
                    required
                    value={newYarn.lot_number}
                    onChange={(e) => setNewYarn({ ...newYarn, lot_number: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Quantity (kg)</label>
                  <input
                    type="number"
                    required
                    value={newYarn.quantity_kg}
                    onChange={(e) => setNewYarn({ ...newYarn, quantity_kg: parseFloat(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Min Alert (kg)</label>
                  <input
                    type="number"
                    required
                    value={newYarn.min_threshold_kg}
                    onChange={(e) => setNewYarn({ ...newYarn, min_threshold_kg: parseFloat(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={newYarn.supplier_name}
                  onChange={(e) => setNewYarn({ ...newYarn, supplier_name: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Cost per kg</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newYarn.cost_per_kg}
                    onChange={(e) => setNewYarn({ ...newYarn, cost_per_kg: parseFloat(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={newYarn.supplier_invoice_number}
                    onChange={(e) => setNewYarn({ ...newYarn, supplier_invoice_number: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Invoice Total</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newYarn.supplier_bill_amount}
                    onChange={(e) => setNewYarn({ ...newYarn, supplier_bill_amount: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DDD3]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2 text-xs uppercase tracking-wider font-semibold text-[#6C7B67] hover:bg-[#EFEAE0] rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs uppercase tracking-wider font-semibold bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] rounded-full shadow-sm"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A3528]/50 p-4">
          <div className="w-full max-w-md border border-[#DDD4C7] bg-[#FAF7F2] p-6 shadow-2xl sm:p-8">
            <h3 className="font-editorial text-2xl text-[#2A3528]">Reserve Yarn for an Order</h3>
            <p className="mb-5 mt-1 text-xs text-[#6C7B67]">Matching-color lots will be allocated by earliest receipt. Production cannot start without full coverage.</p>
            {reservationError && <div className="mb-4 border border-[#EACFC5] bg-[#FAF3F0] p-3 text-xs text-[#9C5A40]">{reservationError}</div>}
            <form onSubmit={handleReserveYarn} className="space-y-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67]">
                Buyer order
                <select required value={reserveOrderId} onChange={(event) => setReserveOrderId(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#DDD4C7] bg-white p-2.5 text-sm normal-case tracking-normal text-[#2A3528]">
                  <option value="" disabled>Select an order</option>
                  {reserveOrders.map((order) => <option key={order.id} value={order.id}>{order.order_code} · {order.color} · {order.quantity_meters} m</option>)}
                </select>
              </label>
              <div className="flex justify-end gap-2 border-t border-[#E3DDD3] pt-4">
                <button type="button" onClick={() => setShowReserveModal(false)} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6C7B67]">Cancel</button>
                <button type="submit" disabled={!reserveOrderId} className="bg-[#53634F] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">Reserve Required Yarn</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
