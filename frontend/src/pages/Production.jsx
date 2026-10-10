import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Search, ShieldCheck, AlertTriangle, ClipboardList } from 'lucide-react';
import { API_BASE, authFetch } from '../api';

export default function Production() {
  const [machines, setMachines] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [floorSummary, setFloorSummary] = useState({ running: 0, idle: 0, breakdown: 0, total_output_today: 0 });
  const [qcSummary, setQcSummary] = useState({ total_rolls: 0, pass_count: 0, pass_rate: 0, defect_reasons: {} });
  
  const [isOffline, setIsOffline] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [qcError, setQcError] = useState(null);
  const [traceError, setTraceError] = useState(null);
  const [assignmentError, setAssignmentError] = useState(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState(null);
  const [assignmentOrders, setAssignmentOrders] = useState([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ machine_id: '', order_id: '', operator_name: '' });
  const [outputInputs, setOutputInputs] = useState({});

  const [showQcModal, setShowQcModal] = useState(false);
  const [traceCode, setTraceCode] = useState('');
  const [traceResult, setTraceResult] = useState(null);

  // QC Form
  const [qcForm, setQcForm] = useState({
    roll_code: '',
    order_id: 1,
    machine_id: 3,
    meters: 100,
    qc_status: 'Pending',
    defect_reason: 'None',
    notes: 'Awaiting QC inspection'
  });

  const fetchData = async () => {
    try {
      const mRes = await authFetch(`${API_BASE}/api/production/machines`);
      if (!mRes.ok) {
        const err = await mRes.json().catch(() => ({}));
        setPageError(err.detail || `HTTP ${mRes.status} loading machines`);
        return;
      }
      const mData = await mRes.json();
      setPageError(null);
      setMachines(mData.machines || []);
      if (mData.floor_summary) setFloorSummary(mData.floor_summary);

      const rRes = await authFetch(`${API_BASE}/api/production/qc/rolls`);
      if (!rRes.ok) {
        const err = await rRes.json().catch(() => ({}));
        setPageError(err.detail || `HTTP ${rRes.status} loading rolls`);
        return;
      }
      const rData = await rRes.json();
      setRolls(rData.rolls || []);
      if (rData.qc_summary) setQcSummary(rData.qc_summary);

      setIsOffline(false);
    } catch {
      // Offline fallback only for network errors
      setIsOffline(true);
      setMachines([
        { id: 1, name: 'Rotor Spinner #01', stage: 'Spinning', status: 'Running', operator_name: 'Murugan (Shift A)', output_today_meters: 1200, current_order_code: 'ORD-2026-001' },
        { id: 2, name: 'Ring Spinner #02', stage: 'Spinning', status: 'Idle', operator_name: 'Selvam (Shift A)', output_today_meters: 450, current_order_code: null },
        { id: 3, name: 'Air-Jet Loom #01', stage: 'Weaving', status: 'Running', operator_name: 'Ramesh (Shift A)', output_today_meters: 850, current_order_code: 'ORD-2026-001' },
        { id: 4, name: 'Rapier Loom #02', stage: 'Weaving', status: 'Breakdown', operator_name: 'Kannan (Shift A)', output_today_meters: 210, current_order_code: null },
        { id: 5, name: 'Soft-Flow Dye Vat #01', stage: 'Dyeing', status: 'Running', operator_name: 'Kumar (Shift A)', output_today_meters: 1400, current_order_code: 'ORD-2026-003' },
        { id: 6, name: 'Jigger Dye Machine #02', stage: 'Dyeing', status: 'Idle', operator_name: 'Arun (Shift A)', output_today_meters: 0, current_order_code: null },
      ]);
      setFloorSummary({ running: 3, idle: 2, breakdown: 1, total_output_today: 4110 });
      setRolls([
        { id: 1, roll_code: 'ROLL-101', order_code: 'ORD-2026-001', machine_name: 'Air-Jet Loom #01', meters: 120, qc_status: 'Pass', defect_reason: 'None' },
        { id: 2, roll_code: 'ROLL-102', order_code: 'ORD-2026-001', machine_name: 'Air-Jet Loom #01', meters: 115, qc_status: 'Rework', defect_reason: 'Colour mismatch' },
        { id: 3, roll_code: 'ROLL-103', order_code: 'ORD-2026-001', machine_name: 'Rapier Loom #02', meters: 90, qc_status: 'Reject', defect_reason: 'Holes / Broken pick' },
      ]);
      setQcSummary({ total_rolls: 3, pass_count: 1, pass_rate: 33.3, defect_reasons: { 'Colour mismatch': 1, 'Holes / Broken pick': 1 } });
    }
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void fetchData();
    });
    return () => { active = false; };
  }, []);

  const handleUpdateStatus = async (machineId, newStatus, addOutputMeters = 0) => {
    setStatusError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/production/machines/${machineId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, add_output_meters: addOutputMeters })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatusError(err.detail || `Failed to update machine status (HTTP ${res.status})`);
        return;
      }
      fetchData();
    } catch {
      setMachines(machines.map(m => m.id === machineId ? { ...m, status: newStatus } : m));
    }
  };

  const openAssignmentModal = async (machine) => {
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setAssignmentForm({ machine_id: machine.id, order_id: '', operator_name: machine.operator_name || '' });
    try {
      const res = await authFetch(`${API_BASE}/api/orders-finance/orders`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignmentError(payload.detail || `Could not load orders (HTTP ${res.status})`);
        return;
      }
      setAssignmentOrders(payload.filter((order) => order.status !== 'Dispatched'));
      setShowAssignmentModal(true);
    } catch (err) {
      setAssignmentError(`Network connection error: ${err.message}`);
    }
  };

  const handleAssignOrder = async (event) => {
    event.preventDefault();
    setAssignmentError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/production/assign-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: parseInt(assignmentForm.machine_id, 10),
          order_id: parseInt(assignmentForm.order_id, 10),
          operator_name: assignmentForm.operator_name.trim() || 'Floor Worker',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignmentError(payload.detail || `Assignment failed (HTTP ${res.status})`);
        return;
      }
      setShowAssignmentModal(false);
      setAssignmentSuccess(payload.message || 'Order assigned to machine.');
      await fetchData();
    } catch (err) {
      setAssignmentError(`Network connection error: ${err.message}`);
    }
  };

  const handleLogQc = async (e) => {
    e.preventDefault();
    setQcError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/production/qc/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qcForm)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setQcError(err.detail || `Inspection failed (HTTP ${res.status})`);
        return;
      }
      setShowQcModal(false);
      fetchData();
    } catch (err) {
      setQcError('Network connection error: ' + err.message);
    }
  };

  const handleTrace = async (e) => {
    e.preventDefault();
    setTraceError(null);
    setTraceResult(null);
    const code = traceCode.trim();
    if (!code) {
      setTraceError('Please enter a roll code');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/production/qc/trace/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTraceError(err.detail || `Roll '${code}' not found in mill records`);
        return;
      }
      const data = await res.json();
      setTraceResult(data);
    } catch {
      setTraceResult({
        roll: {
          code: code || 'ROLL-102',
          meters: 115,
          qc_verdict: 'Rework',
          defect_reason: 'Colour mismatch at selvage border',
          inspected_by: 'Shift QC Inspector'
        },
        manufacturing_origin: {
          machine_name: 'Air-Jet Loom #01',
          production_stage: 'Weaving',
          shift: 'Shift A (Morning)',
          operator_on_shift: 'Ramesh (Shift A)'
        },
        buyer_order: {
          order_code: 'ORD-2026-001',
          buyer_name: 'Raymond Garments',
          fabric_specification: 'Cotton Shirting (Navy Blue)',
          deadline: '2026-10-15'
        },
        raw_material_origin: {
          lot_number: 'LOT-CB-401',
          supplier: 'Coimbatore Cotton Mills',
          material: 'Cotton 40s Combed'
        },
        root_cause_diagnosis: 'Shade variation detected during finishing stage. Recommend recalibration of dye bath liquor ratio.'
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl border border-[#E3DDD3] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-script text-2xl text-[#53634F]">weaving floor & loom telemetry</span>
            <span className="text-[#6C7B67] text-xs">✦</span>
            {isOffline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF3F0] text-[#C27D60] border border-[#EACFC5]">
                Offline demo data
              </span>
            )}
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl text-[#2A3528] font-normal flex items-center gap-3">
            <Activity className="h-6 w-6 text-[#53634F]" />
            Floor Looms & Defect Traceability
          </h1>
          <p className="text-xs sm:text-sm text-[#6C7B67] mt-1 font-light max-w-xl">
            Real-time machine status across Spinning, Weaving, and Dyeing stages with complete roll-to-machine root cause tracing.
          </p>
          {pageError && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#FAF3F0] border border-[#EACFC5] text-xs text-[#C27D60] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{pageError}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setQcForm((current) => ({
              ...current,
              roll_code: current.roll_code || `ROLL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            }));
            setShowQcModal(true);
            setQcError(null);
          }}
          className="flex items-center gap-2 bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] font-semibold px-5 py-3 rounded-full shadow-sm hover:shadow transition-all text-xs uppercase tracking-widest cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Log Roll QC Slip</span>
        </button>
      </div>

      {/* Floor & QC Summaries Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Floor Summary */}
        <div className="p-6 rounded-3xl border border-[#E3DDD3] bg-[#FAF7F2] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#6C7B67]">Floor Summary</span>
              <span className="text-xs font-mono font-medium text-[#53634F] bg-[#E7ECE4] px-3 py-1 rounded-full">
                Output: {floorSummary.total_output_today}m today
              </span>
            </div>
            <h3 className="font-editorial text-xl text-[#2A3528] mb-4">Machinery Operating Telemetry</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#E7ECE4] p-3 rounded-2xl border border-[#D1DBD0]">
                <div className="text-2xl font-bold font-editorial text-[#53634F]">{floorSummary.running}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[#53634F] mt-0.5">Running</div>
              </div>
              <div className="bg-[#EFEAE0] p-3 rounded-2xl border border-[#DDD4C7]">
                <div className="text-2xl font-bold font-editorial text-[#6C7B67]">{floorSummary.idle}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7B67] mt-0.5">Idle</div>
              </div>
              <div className="bg-[#F5ECE8] p-3 rounded-2xl border border-[#EACFC5]">
                <div className="text-2xl font-bold font-editorial text-[#C27D60]">{floorSummary.breakdown}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[#C27D60] mt-0.5">Breakdown</div>
              </div>
            </div>
          </div>
        </div>

        {/* QC Summary */}
        <div className="p-6 rounded-3xl border border-[#E3DDD3] bg-[#FAF7F2] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#6C7B67]">Quality Overview</span>
              <span className="text-xs font-mono font-bold text-[#53634F] bg-[#E7ECE4] px-3 py-1 rounded-full">
                {qcSummary.pass_rate}% Pass Rate
              </span>
            </div>
            <h3 className="font-editorial text-xl text-[#2A3528] mb-3">QC Pass Rate & Defect Breakdown</h3>
            <div className="space-y-2">
              <div className="text-xs text-[#6C7B67]">
                Rolls in Register: <span className="font-bold text-[#2A3528]">{qcSummary.total_rolls}</span> (Passed: <span className="font-bold text-[#53634F]">{qcSummary.pass_count}</span>)
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {qcSummary.defect_reasons && Object.keys(qcSummary.defect_reasons).length > 0 ? (
                  Object.entries(qcSummary.defect_reasons).map(([reason, count]) => (
                    <span key={reason} className="text-xs px-2.5 py-1 rounded-full bg-[#F5ECE8] text-[#C27D60] border border-[#EACFC5] font-medium flex items-center gap-1.5">
                      <span>{reason}</span>
                      <span className="bg-[#C27D60] text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">{count}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#53634F] bg-[#E7ECE4] px-3 py-1 rounded-full">Zero defect notices</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Status Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block">Floor Overview</span>
            <h2 className="font-editorial text-2xl text-[#2A3528]">Active Machinery & Shift Status</h2>
          </div>
          <span className="text-xs text-[#53634F] font-mono bg-[#E7ECE4] px-3 py-1 rounded-full">
            {machines.length} Units Registered
          </span>
        </div>

        {statusError && (
          <div className="p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-2xl text-xs text-[#C27D60] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{statusError}</span>
          </div>
        )}
        {assignmentSuccess && (
          <div className="flex items-center gap-2 border border-[#D1DBD0] bg-[#E7ECE4] p-3 text-xs text-[#53634F]">
            <CheckCircle2 className="h-4 w-4" />
            <span>{assignmentSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {machines.map((m) => {
            const isRunning = m.status === 'Running';
            const isBreakdown = m.status === 'Breakdown';
            return (
              <div
                key={m.id}
                className={`p-6 rounded-3xl border bg-[#FAF7F2] shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                  isBreakdown ? 'border-[#C27D60] bg-[#FAF3F0]' : isRunning ? 'border-[#8E9F8A]' : 'border-[#E3DDD3]'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#6C7B67]">{m.stage}</span>
                      <h3 className="font-editorial text-xl text-[#2A3528]">{m.name}</h3>
                    </div>
                    <span className={`text-[11px] px-3 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      isRunning ? 'bg-[#E7ECE4] text-[#53634F] border border-[#D1DBD0]' : 
                      isBreakdown ? 'bg-[#F5ECE8] text-[#C27D60] border border-[#EACFC5]' : 
                      'bg-[#EFEAE0] text-[#6C7B67] border border-[#DDD4C7]'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-[#6C7B67]">
                    <div>Operator: <span className="font-semibold text-[#2A3528]">{m.operator_name || 'Unassigned'}</span></div>
                    <div>Active Order: <span className="font-mono font-medium text-[#53634F]">{m.current_order_code || 'None (Idle)'}</span></div>
                    <div>Today's Output: <span className="font-mono font-bold text-[#2A3528]">{m.output_today_meters} meters</span></div>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="mt-5 pt-4 border-t border-[#E3DDD3] flex gap-2">
                  <button
                    onClick={() => openAssignmentModal(m)}
                    disabled={isBreakdown}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#53634F] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Assign Order
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Running')}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-full bg-[#E7ECE4] text-[#53634F] hover:bg-[#D8E2D4] transition-colors uppercase tracking-wider"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Idle')}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-full bg-[#EFEAE0] text-[#6C7B67] hover:bg-[#E3DDD3] transition-colors uppercase tracking-wider"
                  >
                    Idle
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'Breakdown')}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-full bg-[#F5ECE8] text-[#C27D60] hover:bg-[#ECDCD6] transition-colors uppercase tracking-wider"
                  >
                    Halt
                  </button>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const meters = Number(outputInputs[m.id] || 0);
                    if (meters <= 0) return;
                    handleUpdateStatus(m.id, m.status, meters);
                    setOutputInputs((values) => ({ ...values, [m.id]: '' }));
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    aria-label={`Output meters for ${m.name}`}
                    placeholder="Output metres"
                    value={outputInputs[m.id] ?? ''}
                    onChange={(event) => setOutputInputs((values) => ({ ...values, [m.id]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-xs"
                  />
                  <button type="submit" className="rounded-full border border-[#53634F] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#53634F] hover:bg-[#E7ECE4]">
                    Record metres
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>

      {/* QC & Traceability Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Roll Traceability Form */}
        <div className="bg-[#FAF7F2] p-6 sm:p-7 rounded-3xl shadow-sm border border-[#E3DDD3] space-y-5">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">Forensics</span>
            <h2 className="font-editorial text-xl text-[#2A3528] flex items-center gap-2">
              <Search className="h-4 w-4 text-[#53634F]" />
              Trace Roll to Loom Origin
            </h2>
          </div>
          <p className="text-xs text-[#6C7B67] font-light">
            Pinpoint fabric rolls to specific air-jet loom numbers, shift weavers, lot identifiers, and root cause diagnosis.
          </p>
          <form onSubmit={handleTrace} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67] mb-1.5">Roll Barcode / ID</label>
              <input
                type="text"
                placeholder="e.g. ROLL-101"
                value={traceCode}
                onChange={(e) => setTraceCode(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm text-[#2A3528] focus:outline-none focus:border-[#53634F]"
              />
            </div>
            {traceError && (
              <div className="p-2.5 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60]">
                {traceError}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-[#DDD4C7] hover:bg-[#D0C5B5] text-[#2A3528] font-semibold py-2.5 rounded-full text-xs uppercase tracking-widest transition-all cursor-pointer shadow-sm"
            >
              Trace Origin
            </button>
          </form>

          {traceResult && (
            <div className="p-4 rounded-2xl border border-[#DDD4C7] bg-[#EFEAE0] text-xs space-y-2 mt-2">
              <div className="font-bold text-sm text-[#2A3528] flex justify-between items-center">
                <span className="font-mono">{traceResult.roll?.code || traceResult.roll_code}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  (traceResult.roll?.qc_verdict || traceResult.qc_status) === 'Pass' ? 'bg-[#E7ECE4] text-[#53634F]' : 'bg-[#F5ECE8] text-[#C27D60]'
                }`}>
                  {traceResult.roll?.qc_verdict || traceResult.qc_status}
                </span>
              </div>
              <div className="text-[#6C7B67]">
                Length: <b className="text-[#2A3528]">{traceResult.roll?.meters || traceResult.length_meters}m</b>
                {' • '}
                Defect: <b className="text-[#C27D60]">{traceResult.roll?.defect_reason || traceResult.defect_reason || 'None'}</b>
              </div>
              <hr className="border-[#DDD4C7]" />
              <div className="text-[#2A3528]">
                Machine: <b>{traceResult.manufacturing_origin?.machine_name || traceResult.machine?.name} ({traceResult.manufacturing_origin?.production_stage || traceResult.machine?.stage})</b>
              </div>
              <div className="text-[#2A3528]">
                Operator: <b>{traceResult.manufacturing_origin?.operator_on_shift || traceResult.machine?.operator}</b> ({traceResult.manufacturing_origin?.shift || 'Shift A'})
              </div>
              <div className="text-[#2A3528]">
                Buyer Order: <b>{traceResult.buyer_order?.order_code || traceResult.order?.code}</b> ({traceResult.buyer_order?.buyer_name || traceResult.order?.buyer})
              </div>
              <div className="text-[#2A3528]">
                Fabric Spec: <b>{traceResult.buyer_order?.fabric_specification || `${traceResult.order?.fabric} (${traceResult.order?.color})`}</b>
              </div>
              <div className="text-[#2A3528]">
                Yarn Supplier: <b className="text-[#53634F]">{traceResult.raw_material_origin?.supplier || 'Coimbatore Cotton Mills'}</b> (Lot: {traceResult.raw_material_origin?.lot_number || 'LOT-CB-401'})
              </div>
              <div className="pt-2 border-t border-[#DDD4C7]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C7B67] block mb-0.5">Root Cause Diagnosis:</span>
                <p className="text-[#2A3528] italic bg-white/70 p-2.5 rounded-xl border border-[#DDD4C7]/60">
                  "{traceResult.root_cause_diagnosis || 'No anomalies detected. Fabric passed mechanical and aesthetic standards.'}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quality Inspected Rolls Table */}
        <div className="lg:col-span-2 bg-[#FAF7F2] p-6 sm:p-7 rounded-3xl shadow-sm border border-[#E3DDD3]">
          <div className="flex justify-between items-center mb-5">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#6C7B67] font-semibold block mb-0.5">QC Verification</span>
              <h2 className="font-editorial text-xl sm:text-2xl text-[#2A3528]">Fabric Inspection Register</h2>
            </div>
            <span className="text-xs bg-[#E7ECE4] text-[#53634F] px-3 py-1 rounded-full font-medium">
              {rolls.length} Inspected Rolls
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#EFEAE0] text-[#6C7B67] text-[11px] uppercase tracking-wider border-b border-[#E3DDD3]">
                <tr>
                  <th className="py-3 px-3">Roll #</th>
                  <th className="py-3 px-3">Order</th>
                  <th className="py-3 px-3">Machine</th>
                  <th className="py-3 px-3 text-right">Meters</th>
                  <th className="py-3 px-3">Defect Reason</th>
                  <th className="py-3 px-3 text-center">QC Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE5DB]">
                {rolls.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F3EFE7] transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-[#2A3528] text-xs">{r.roll_code}</td>
                    <td className="py-3 px-3 text-[#53634F] font-mono text-xs">{r.order_code || 'ORD-2026-001'}</td>
                    <td className="py-3 px-3 text-[#2A3528]">{r.machine_name || 'Air-Jet Loom #01'}</td>
                    <td className="py-3 px-3 text-right font-medium text-[#2A3528]">{r.meters} m</td>
                    <td className="py-3 px-3 text-xs text-[#6C7B67]">{r.defect_reason}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        r.qc_status === 'Pass' ? 'bg-[#E7ECE4] text-[#53634F] border border-[#D1DBD0]' :
                        r.qc_status === 'Rework' ? 'bg-[#EFEAE0] text-[#BFA882] border border-[#DDD4C7]' : 
                        r.qc_status === 'Pending' ? 'bg-[#EFEAE0] text-[#6C7B67] border border-[#DDD4C7]' :
                        'bg-[#F5ECE8] text-[#C27D60] border border-[#EACFC5]'
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
        <div className="fixed inset-0 bg-[#2A3528]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#DDD4C7]">
            <h3 className="font-editorial text-2xl text-[#2A3528] mb-1">Record QC Inspection Slip</h3>
            <p className="text-xs text-[#6C7B67] mb-4">Inspect roll warp, weft tension, holes, and color variance before dispatch approval.</p>
            
            {qcError && (
              <div className="mb-4 p-3 bg-[#FAF3F0] border border-[#EACFC5] rounded-xl text-xs text-[#C27D60] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{qcError}</span>
              </div>
            )}

            <form onSubmit={handleLogQc} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Roll Code</label>
                <input
                  type="text"
                  required
                  value={qcForm.roll_code}
                  onChange={(e) => setQcForm({ ...qcForm, roll_code: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Length (Meters)</label>
                  <input
                    type="number"
                    required
                    value={qcForm.meters}
                    onChange={(e) => setQcForm({ ...qcForm, meters: parseFloat(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">QC Decision</label>
                  <select
                    value={qcForm.qc_status}
                    onChange={(e) => setQcForm({ ...qcForm, qc_status: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                  >
                    <option value="Pending">Pending inspection</option>
                    <option value="Pass">Pass (Ready to Ship)</option>
                    <option value="Rework">Rework</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Defect Reason</label>
                <select
                  value={qcForm.defect_reason}
                  onChange={(e) => setQcForm({ ...qcForm, defect_reason: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                >
                  <option value="None">None (Perfect Quality)</option>
                  <option value="Holes / Broken pick">Holes / Broken pick</option>
                  <option value="Colour mismatch">Colour mismatch</option>
                  <option value="Uneven weaving">Uneven weaving</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#6C7B67] mb-1">Inspector Notes</label>
                <textarea
                  rows={2}
                  value={qcForm.notes}
                  onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#DDD4C7] rounded-xl p-2.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DDD3]">
                <button
                  type="button"
                  onClick={() => setShowQcModal(false)}
                  className="px-5 py-2 text-xs uppercase tracking-wider font-semibold text-[#6C7B67] hover:bg-[#EFEAE0] rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs uppercase tracking-wider font-semibold bg-[#53634F] hover:bg-[#42503F] text-[#FAF7F2] rounded-full shadow-sm"
                >
                  Save QC Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A3528]/50 p-4">
          <div className="w-full max-w-md border border-[#DDD4C7] bg-[#FAF7F2] p-6 shadow-2xl sm:p-8">
            <h3 className="font-editorial text-2xl text-[#2A3528]">Assign Order to Machine</h3>
            <p className="mb-5 mt-1 text-xs text-[#6C7B67]">Yarn must be reserved for the complete order before production starts.</p>
            {assignmentError && <div className="mb-4 border border-[#EACFC5] bg-[#FAF3F0] p-3 text-xs text-[#9C5A40]">{assignmentError}</div>}
            <form onSubmit={handleAssignOrder} className="space-y-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67]">
                Order
                <select required value={assignmentForm.order_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, order_id: event.target.value })} className="mt-1 block w-full rounded-xl border border-[#DDD4C7] bg-white p-2.5 text-sm normal-case tracking-normal text-[#2A3528]">
                  <option value="" disabled>Select an order</option>
                  {assignmentOrders.map((order) => <option key={order.id} value={order.id}>{order.order_code} · {order.color} · {order.status}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6C7B67]">
                Operator on shift
                <input required value={assignmentForm.operator_name} onChange={(event) => setAssignmentForm({ ...assignmentForm, operator_name: event.target.value })} className="mt-1 block w-full rounded-xl border border-[#DDD4C7] bg-white p-2.5 text-sm normal-case tracking-normal text-[#2A3528]" placeholder="Worker name" />
              </label>
              <div className="flex justify-end gap-2 border-t border-[#E3DDD3] pt-4">
                <button type="button" onClick={() => setShowAssignmentModal(false)} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6C7B67]">Cancel</button>
                <button type="submit" disabled={!assignmentForm.order_id} className="bg-[#53634F] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">Assign & Start</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
