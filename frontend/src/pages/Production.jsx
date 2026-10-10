import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertOctagon, RotateCcw, Wrench, Search, ShieldCheck } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/production';

export default function Production() {
  const [machines, setMachines] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [showQcModal, setShowQcModal] = useState(false);
  const [traceCode, setTraceCode] = useState('');
  const [traceResult, setTraceResult] = useState(null);

  // QC Form
  const [qcForm, setQcForm] = useState({
    roll_code: 'ROLL-' + Math.floor(100 + Math.random() * 900),
    order_id: 1,
    machine_id: 3,
    meters: 100,
    qc_status: 'Pass',
    defect_reason: 'None',
    notes: 'Approved for packing'
  });

  const fetchData = async () => {
    try {
      const mRes = await fetch(`${API_BASE}/machines`);
      if (mRes.ok) setMachines(await mRes.json());
      const rRes = await fetch(`${API_BASE}/qc/rolls`);
      if (rRes.ok) setRolls(await rRes.json());
    } catch {
      // Offline fallback
      setMachines([
        { id: 1, name: 'Rotor Spinner #01', stage: 'Spinning', status: 'Running', operator_name: 'Murugan (Shift A)', output_today_meters: 1200, current_order_code: 'ORD-2026-001' },
        { id: 2, name: 'Ring Spinner #02', stage: 'Spinning', status: 'Idle', operator_name: 'Selvam (Shift A)', output_today_meters: 450, current_order_code: null },
        { id: 3, name: 'Air-Jet Loom #01', stage: 'Weaving', status: 'Running', operator_name: 'Ramesh (Shift A)', output_today_meters: 850, current_order_code: 'ORD-2026-001' },
        { id: 4, name: 'Rapier Loom #02', stage: 'Weaving', status: 'Breakdown', operator_name: 'Kannan (Shift A)', output_today_meters: 210, current_order_code: null },
        { id: 5, name: 'Soft-Flow Dye Vat #01', stage: 'Dyeing', status: 'Running', operator_name: 'Kumar (Shift A)', output_today_meters: 1400, current_order_code: 'ORD-2026-003' },
        { id: 6, name: 'Jigger Dye Machine #02', stage: 'Dyeing', status: 'Idle', operator_name: 'Arun (Shift A)', output_today_meters: 0, current_order_code: null },
      ]);
      setRolls([
        { id: 1, roll_code: 'ROLL-101', order_code: 'ORD-2026-001', machine_name: 'Air-Jet Loom #01', meters: 120, qc_status: 'Pass', defect_reason: 'None' },
        { id: 2, roll_code: 'ROLL-102', order_code: 'ORD-2026-001', machine_name: 'Air-Jet Loom #01', meters: 115, qc_status: 'Rework', defect_reason: 'Colour mismatch' },
        { id: 3, roll_code: 'ROLL-103', order_code: 'ORD-2026-001', machine_name: 'Rapier Loom #02', meters: 90, qc_status: 'Reject', defect_reason: 'Holes / Broken pick' },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (machineId, newStatus) => {
    try {
      await fetch(`${API_BASE}/machines/${machineId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch {
      setMachines(machines.map(m => m.id === machineId ? { ...m, status: newStatus } : m));
    }
  };

  const handleLogQc = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/qc/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qcForm)
      });
      setShowQcModal(false);
      fetchData();
    } catch (err) {
      alert('Error recording inspection: ' + err.message);
    }
  };

  const handleTrace = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/qc/trace/${traceCode.trim()}`);
      if (res.ok) {
        setTraceResult(await res.json());
      } else {
        alert('Roll not found!');
      }
    } catch {
      // Mock trace fallback
      setTraceResult({
        roll_code: traceCode || 'ROLL-102',
        qc_status: 'Rework',
        defect_reason: 'Colour mismatch at selvage',
        length_meters: 115,
        machine: { name: 'Air-Jet Loom #01', stage: 'Weaving', operator: 'Ramesh (Shift A)' },
        order: { code: 'ORD-2026-001', buyer: 'Raymond Garments', fabric: 'Cotton Shirting', color: 'Navy Blue' }
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            Scene 2 & 3: Production Floor & Quality Check
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time machine status (Spinning, Weaving, Dyeing), breakdown logging, and fabric defect traceability.
          </p>
        </div>
        <button
          onClick={() => setShowQcModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          <ShieldCheck className="h-5 w-5" />
          Log Fabric Roll QC Slip
        </button>
      </div>

      {/* Machine Status Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Floor Machines (Live Shift Status)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m) => {
            const isRunning = m.status === 'Running';
            const isBreakdown = m.status === 'Breakdown';
            return (
              <div
                key={m.id}
                className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition-all ${
                  isBreakdown ? 'border-rose-400 bg-rose-50/20' : isRunning ? 'border-emerald-300' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{m.stage}</span>
                      <h3 className="text-base font-bold text-slate-900">{m.name}</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      isRunning ? 'bg-emerald-100 text-emerald-800' : isBreakdown ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div>Operator: <span className="font-semibold text-slate-800">{m.operator_name || 'Unassigned'}</span></div>
                    <div>Active Order: <span className="font-semibold text-slate-800">{m.current_order_code || 'None (Idle)'}</span></div>
                    <div>Today's Output: <span className="font-bold text-slate-900">{m.output_today_meters} meters</span></div>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Running')}
                    className="flex-1 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Idle')}
                    className="flex-1 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Idle
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Breakdown')}
                    className="flex-1 py-1 text-xs font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    Breakdown
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QC & Traceability Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Roll Traceability Form */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-600" />
            Trace Roll to Source
          </h2>
          <p className="text-xs text-slate-500">
            Scene 3 requirement: Trace any defect directly to the machine, shift worker, and buyer order.
          </p>
          <form onSubmit={handleTrace} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Barcode / Code</label>
              <input
                type="text"
                placeholder="e.g. ROLL-102"
                value={traceCode}
                onChange={(e) => setTraceCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm"
            >
              Trace Origin
            </button>
          </form>

          {traceResult && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2 mt-2">
              <div className="font-bold text-sm text-slate-900 flex justify-between">
                <span>{traceResult.roll_code}</span>
                <span className={`px-2 py-0.5 rounded ${
                  traceResult.qc_status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {traceResult.qc_status}
                </span>
              </div>
              <div className="text-slate-600">Defect Reason: <b className="text-rose-700">{traceResult.defect_reason || 'None'}</b></div>
              <hr className="border-slate-200" />
              <div>Machine: <b>{traceResult.machine?.name} ({traceResult.machine?.stage})</b></div>
              <div>Shift Operator: <b>{traceResult.machine?.operator}</b></div>
              <div>Order: <b>{traceResult.order?.code} ({traceResult.order?.buyer})</b></div>
            </div>
          )}
        </div>

        {/* Quality Inspected Rolls Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">QC Inspection Log (Pass / Rework / Reject)</h2>
            <span className="text-xs text-slate-500">{rolls.length} Inspected Rolls</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Roll #</th>
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3 text-right">Meters</th>
                  <th className="py-2.5 px-3">Defect Reason</th>
                  <th className="py-2.5 px-3 text-center">QC Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rolls.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">{r.roll_code}</td>
                    <td className="py-3 px-3 text-slate-700">{r.order_code || 'ORD-2026-001'}</td>
                    <td className="py-3 px-3 text-slate-700">{r.machine_name || 'Air-Jet Loom #01'}</td>
                    <td className="py-3 px-3 text-right font-medium">{r.meters} m</td>
                    <td className="py-3 px-3 text-xs text-slate-500">{r.defect_reason}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        r.qc_status === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                        r.qc_status === 'Rework' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.qc_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QC Modal */}
      {showQcModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Record QC Inspection Slip</h3>
            <p className="text-xs text-slate-500 mb-4">Before fabric is packed, inspect for holes, color mismatch, or uneven weaving.</p>
            <form onSubmit={handleLogQc} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Code</label>
                <input
                  type="text"
                  required
                  value={qcForm.roll_code}
                  onChange={(e) => setQcForm({ ...qcForm, roll_code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Length (Meters)</label>
                  <input
                    type="number"
                    required
                    value={qcForm.meters}
                    onChange={(e) => setQcForm({ ...qcForm, meters: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">QC Decision</label>
                  <select
                    value={qcForm.qc_status}
                    onChange={(e) => setQcForm({ ...qcForm, qc_status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="Pass">Pass (Ready to Ship)</option>
                    <option value="Rework">Rework</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Defect Reason (if any)</label>
                <select
                  value={qcForm.defect_reason}
                  onChange={(e) => setQcForm({ ...qcForm, defect_reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                >
                  <option value="None">None (Perfect Quality)</option>
                  <option value="Holes / Broken pick">Holes / Broken pick</option>
                  <option value="Colour mismatch">Colour mismatch</option>
                  <option value="Uneven weaving">Uneven weaving</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inspector Notes</label>
                <textarea
                  rows={2}
                  value={qcForm.notes}
                  onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQcModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  Save QC Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
