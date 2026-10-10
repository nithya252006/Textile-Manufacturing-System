import React, { useState, useEffect } from 'react';
import { Truck, AlertTriangle, PlusCircle, CheckCircle2, Search, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/inventory';

export default function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
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
    cost_per_kg: 275
  });

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/yarn`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data);
      }
      const alertRes = await fetch(`${API_BASE}/alerts`);
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlerts(alertData);
      }
    } catch {
      // Offline fallback sample data
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
    try {
      await fetch(`${API_BASE}/yarn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newYarn)
      });
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      alert('Error submitting gate entry: ' + err.message);
    }
  };

  const handleCheckMaterial = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/check-material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabric_type: 'Fabric',
          color: checkForm.color,
          required_meters: parseFloat(checkForm.meters)
        })
      });
      const data = await res.json();
      setCheckResult(data);
    } catch {
      // Mock calculation: 0.3kg per meter
      const reqKg = checkForm.meters * 0.3;
      setCheckResult({
        fabric_type: 'Fabric',
        color: checkForm.color,
        required_kg: reqKg,
        available_kg: 450,
        is_sufficient: 450 >= reqKg,
        action_needed: 450 >= reqKg ? 'Ready to Start Production' : 'Need more yarn'
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-500" />
            Scene 1: Yarn Arrives at the Gate & Raw Material Store
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track yarn truck entries, get low stock threshold alerts, and verify raw materials before starting orders.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          Log Incoming Truck (Gate Entry)
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold">
            <AlertTriangle className="h-5 w-5" />
            <span>Low Stock Warning Threshold Triggered</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-rose-700">
            {alerts.map((al, idx) => (
              <div key={idx} className="bg-white/80 px-3 py-1.5 rounded border border-rose-200">
                ⚠️ {al.alert || al}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Material Check & Stocks Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pre-Production Material Check */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-600" />
            Pre-Order Material Check
          </h2>
          <p className="text-xs text-slate-500">
            Check if the mill has sufficient yarn in stock before accepting or starting a new buyer order.
          </p>
          <form onSubmit={handleCheckMaterial} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Color / Yarn Shade</label>
              <input
                type="text"
                value={checkForm.color}
                onChange={(e) => setCheckForm({ ...checkForm, color: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Quantity (Meters)</label>
              <input
                type="number"
                value={checkForm.meters}
                onChange={(e) => setCheckForm({ ...checkForm, meters: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              Check Availability
            </button>
          </form>

          {checkResult && (
            <div className={`p-4 rounded-lg border text-sm mt-3 ${
              checkResult.is_sufficient ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                {checkResult.is_sufficient ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {checkResult.action_needed}
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div>Required Yarn: <b>{checkResult.required_kg} kg</b></div>
                <div>Available Yarn: <b>{checkResult.available_kg} kg</b></div>
              </div>
            </div>
          )}
        </div>

        {/* Yarn Stock Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Current Raw Material Inventory</h2>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
              {stocks.length} Lots in Store
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Lot #</th>
                  <th className="py-2.5 px-3">Yarn Material</th>
                  <th className="py-2.5 px-3">Color</th>
                  <th className="py-2.5 px-3 text-right">Stock (kg)</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">{item.lot_number}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{item.material_name}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                        {item.color}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">{item.quantity_kg} kg</td>
                    <td className="py-3 px-3 text-xs text-slate-500">{item.supplier_name}</td>
                    <td className="py-3 px-3 text-center">
                      {item.is_low_stock ? (
                        <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded-full font-bold">
                          Low Stock
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Gate Entry: Yarn Arrival</h3>
            <p className="text-xs text-slate-500 mb-4">Note down arriving supplier truck details into the mill system.</p>
            <form onSubmit={handleAddYarn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yarn Material Type</label>
                <input
                  type="text"
                  required
                  value={newYarn.material_name}
                  onChange={(e) => setNewYarn({ ...newYarn, material_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Color / Shade</label>
                  <input
                    type="text"
                    required
                    value={newYarn.color}
                    onChange={(e) => setNewYarn({ ...newYarn, color: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lot Number</label>
                  <input
                    type="text"
                    required
                    value={newYarn.lot_number}
                    onChange={(e) => setNewYarn({ ...newYarn, lot_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity (kg)</label>
                  <input
                    type="number"
                    required
                    value={newYarn.quantity_kg}
                    onChange={(e) => setNewYarn({ ...newYarn, quantity_kg: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Alert (kg)</label>
                  <input
                    type="number"
                    required
                    value={newYarn.min_threshold_kg}
                    onChange={(e) => setNewYarn({ ...newYarn, min_threshold_kg: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={newYarn.supplier_name}
                  onChange={(e) => setNewYarn({ ...newYarn, supplier_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg shadow-sm"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
