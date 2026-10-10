import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ReceiptText, Users } from 'lucide-react';
import { API_BASE, authFetch } from '../api';

const today = new Date().toISOString().slice(0, 10);

async function requestJson(path, options = {}) {
  const response = await authFetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Request failed (HTTP ${response.status})`);
  return payload;
}

export default function Accounting() {
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [supplierBills, setSupplierBills] = useState([]);
  const [buyerBalances, setBuyerBalances] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [workerForm, setWorkerForm] = useState({ name: '', job_title: '', daily_wage: 0 });
  const [attendanceForm, setAttendanceForm] = useState({ worker_id: '', attendance_date: today, shift: 'Shift A', status: 'Present', order_id: '' });
  const [buyerPayment, setBuyerPayment] = useState({ order_id: '', amount: '', reference: '' });
  const [wageAmounts, setWageAmounts] = useState({});
  const [supplierAmounts, setSupplierAmounts] = useState({});

  const loadData = async () => {
    setError('');
    try {
      const [workerRows, attendanceRows, billRows, buyerRows] = await Promise.all([
        requestJson('/api/accounting/workers'),
        requestJson('/api/accounting/attendance'),
        requestJson('/api/accounting/supplier-bills'),
        requestJson('/api/accounting/buyer-balances'),
      ]);
      setWorkers(workerRows);
      setAttendance(attendanceRows);
      setSupplierBills(billRows);
      setBuyerBalances(buyerRows);
      if (!attendanceForm.worker_id && workerRows.length) {
        setAttendanceForm((current) => ({ ...current, worker_id: String(workerRows[0].id) }));
      }
      if (!buyerPayment.order_id && buyerRows.length) {
        const dueOrder = buyerRows.find((order) => order.balance > 0) || buyerRows[0];
        setBuyerPayment((current) => ({ ...current, order_id: String(dueOrder.order_id) }));
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load accounting records.');
    }
  };

  useEffect(() => { loadData(); }, []);

  const submit = async (path, body, successMessage) => {
    setError('');
    setNotice('');
    try {
      await requestJson(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNotice(successMessage);
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message || 'Could not save the accounting record.');
      return false;
    }
  };

  const handleAddWorker = async (event) => {
    event.preventDefault();
    const saved = await submit('/api/accounting/workers', {
      ...workerForm,
      daily_wage: Number(workerForm.daily_wage),
    }, 'Worker profile saved.');
    if (saved) setWorkerForm({ name: '', job_title: '', daily_wage: 0 });
  };

  const handleAttendance = async (event) => {
    event.preventDefault();
    await submit('/api/accounting/attendance', {
      ...attendanceForm,
      worker_id: Number(attendanceForm.worker_id),
      order_id: attendanceForm.order_id ? Number(attendanceForm.order_id) : null,
    }, 'Attendance saved for the selected shift.');
  };

  const handleWagePayment = async (attendanceId, event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await submit(`/api/accounting/attendance/${attendanceId}/payments`, {
      amount: Number(form.get('amount')),
      reference: form.get('reference') || null,
    }, 'Wage payment recorded.');
    if (saved) setWageAmounts((values) => ({ ...values, [attendanceId]: '' }));
  };

  const handleSupplierPayment = async (billId, event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await submit(`/api/accounting/supplier-bills/${billId}/payments`, {
      amount: Number(form.get('amount')),
      reference: form.get('reference') || null,
    }, 'Supplier payment recorded.');
    if (saved) setSupplierAmounts((values) => ({ ...values, [billId]: '' }));
  };

  const handleBuyerPayment = async (event) => {
    event.preventDefault();
    const saved = await submit(`/api/accounting/orders/${buyerPayment.order_id}/payments`, {
      amount: Number(buyerPayment.amount),
      reference: buyerPayment.reference || null,
    }, 'Buyer receipt recorded.');
    if (saved) setBuyerPayment((current) => ({ ...current, amount: '', reference: '' }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-[#DCD5CA] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6C7B67]"><ReceiptText className="h-4 w-4 text-[#53634F]" /> Owner accounting</div>
          <h1 className="font-editorial text-3xl text-[#2A3528] sm:text-4xl">Payroll & Settlements</h1>
          <p className="mt-2 text-sm text-[#6C7B67]">Record worker attendance, wage payments, supplier bills, and buyer receipts.</p>
        </div>
      </header>

      {error && <div className="flex items-center gap-2 border-l-4 border-[#C27D60] bg-[#F5ECE8] px-4 py-3 text-sm text-[#7A3F2A]"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {notice && <div className="flex items-center gap-2 border border-[#D1DBD0] bg-[#E7ECE4] px-4 py-3 text-sm text-[#53634F]"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

      <section className="grid gap-8 border-b border-[#E3DDD3] pb-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-[#53634F]" /><h2 className="font-editorial text-xl text-[#2A3528]">Worker register</h2></div>
          <form onSubmit={handleAddWorker} className="grid gap-3 sm:grid-cols-[1fr_1fr_130px_auto]">
            <input required aria-label="Worker name" placeholder="Worker name" value={workerForm.name} onChange={(event) => setWorkerForm({ ...workerForm, name: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <input required aria-label="Job title" placeholder="Job title" value={workerForm.job_title} onChange={(event) => setWorkerForm({ ...workerForm, job_title: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <input required min="0" step="0.01" type="number" aria-label="Daily wage" placeholder="Daily wage" value={workerForm.daily_wage} onChange={(event) => setWorkerForm({ ...workerForm, daily_wage: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <button className="rounded-full bg-[#53634F] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white">Add worker</button>
          </form>
          <ul className="mt-4 divide-y divide-[#E3DDD3]">
            {workers.map((worker) => <li key={worker.id} className="flex justify-between py-2 text-sm"><span>{worker.name} <span className="text-xs text-[#6C7B67]">· {worker.job_title}</span></span><span className="font-mono text-[#53634F]">₹{worker.daily_wage}/day</span></li>)}
            {!workers.length && <li className="py-3 text-xs text-[#6C7B67]">No active workers registered.</li>}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-editorial text-xl text-[#2A3528]">Shift attendance</h2>
          <form onSubmit={handleAttendance} className="grid gap-3 sm:grid-cols-2">
            <select required value={attendanceForm.worker_id} onChange={(event) => setAttendanceForm({ ...attendanceForm, worker_id: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm">
              <option value="" disabled>Select worker</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} · ₹{worker.daily_wage}</option>)}
            </select>
            <input required type="date" value={attendanceForm.attendance_date} onChange={(event) => setAttendanceForm({ ...attendanceForm, attendance_date: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <select value={attendanceForm.shift} onChange={(event) => setAttendanceForm({ ...attendanceForm, shift: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm"><option>Shift A</option><option>Shift B</option><option>Shift C</option></select>
            <select value={attendanceForm.status} onChange={(event) => setAttendanceForm({ ...attendanceForm, status: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm"><option>Present</option><option>Absent</option><option>Leave</option></select>
            <select value={attendanceForm.order_id} onChange={(event) => setAttendanceForm({ ...attendanceForm, order_id: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm sm:col-span-2"><option value="">No order allocated</option>{buyerBalances.map((order) => <option key={order.order_id} value={order.order_id}>{order.order_code} · {order.buyer_name}</option>)}</select>
            <button disabled={!workers.length} className="rounded-full bg-[#53634F] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50 sm:col-span-2">Save attendance</button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-editorial text-xl text-[#2A3528]">Wages by attendance</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#DDD4C7] text-[10px] uppercase tracking-wider text-[#6C7B67]"><tr><th className="py-2">Date / Shift</th><th>Worker</th><th>Order</th><th>Status</th><th>Wage</th><th>Paid / Balance</th><th>Record payment</th></tr></thead>
            <tbody className="divide-y divide-[#EBE5DB]">
              {attendance.map((record) => <tr key={record.id}>
                <td className="py-3 text-xs text-[#6C7B67]">{record.attendance_date} · {record.shift}</td><td>{record.worker_name}</td><td className="font-mono text-xs">{record.order_code || '—'}</td><td>{record.status}</td><td>₹{record.daily_wage}</td><td className="text-xs">₹{record.paid_amount} / ₹{record.balance}</td>
                <td>{record.balance > 0 && record.status === 'Present' ? <form onSubmit={(event) => handleWagePayment(record.id, event)} className="flex gap-1"><input required min="0.01" max={record.balance} step="0.01" type="number" name="amount" aria-label={`Wage payment amount ${record.worker_name}`} className="w-24 rounded border border-[#DDD4C7] px-2 py-1 text-xs" /><input name="reference" aria-label="Wage payment reference" placeholder="Ref" className="w-20 rounded border border-[#DDD4C7] px-2 py-1 text-xs" /><button className="text-xs font-semibold text-[#53634F]">Pay</button></form> : <span className="text-xs text-[#6C7B67]">Settled</span>}</td>
              </tr>)}
              {!attendance.length && <tr><td colSpan="7" className="py-5 text-center text-xs text-[#6C7B67]">No attendance records entered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-10 border-t border-[#E3DDD3] pt-7 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-editorial text-xl text-[#2A3528]">Supplier bills</h2>
          <ul className="divide-y divide-[#E3DDD3]">
            {supplierBills.map((bill) => <li key={bill.id} className="py-3">
              <div className="flex justify-between gap-3 text-sm"><span>{bill.supplier_name} · <span className="font-mono">{bill.invoice_number}</span></span><span>₹{bill.total_amount}</span></div>
              <div className="mt-1 flex justify-between text-xs text-[#6C7B67]"><span>Paid ₹{bill.paid_amount}</span><span>Balance ₹{bill.balance}</span></div>
              {bill.balance > 0 && <form onSubmit={(event) => handleSupplierPayment(bill.id, event)} className="mt-2 flex gap-2"><input required min="0.01" max={bill.balance} step="0.01" type="number" name="amount" aria-label={`Supplier payment amount ${bill.invoice_number}`} placeholder="Amount" className="w-28 rounded border border-[#DDD4C7] px-2 py-1 text-xs" /><input name="reference" aria-label="Supplier payment reference" placeholder="Payment ref" className="w-32 rounded border border-[#DDD4C7] px-2 py-1 text-xs" /><button className="text-xs font-semibold text-[#53634F]">Record payment</button></form>}
            </li>)}
            {!supplierBills.length && <li className="py-5 text-xs text-[#6C7B67]">Supplier invoices entered at yarn intake appear here.</li>}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-editorial text-xl text-[#2A3528]">Buyer receipts</h2>
          <form onSubmit={handleBuyerPayment} className="grid gap-3 sm:grid-cols-2">
            <select required value={buyerPayment.order_id} onChange={(event) => setBuyerPayment({ ...buyerPayment, order_id: event.target.value })} className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm sm:col-span-2"><option value="" disabled>Select buyer order</option>{buyerBalances.map((order) => <option key={order.order_id} value={order.order_id}>{order.order_code} · {order.buyer_name} · due ₹{order.balance}</option>)}</select>
            <input required min="0.01" step="0.01" type="number" value={buyerPayment.amount} onChange={(event) => setBuyerPayment({ ...buyerPayment, amount: event.target.value })} aria-label="Buyer payment amount" placeholder="Amount received" className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <input value={buyerPayment.reference} onChange={(event) => setBuyerPayment({ ...buyerPayment, reference: event.target.value })} aria-label="Buyer payment reference" placeholder="Bank / receipt reference" className="rounded-xl border border-[#DDD4C7] bg-white px-3 py-2 text-sm" />
            <button disabled={!buyerBalances.length} className="rounded-full bg-[#53634F] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50 sm:col-span-2">Record buyer receipt</button>
          </form>
          <ul className="mt-4 divide-y divide-[#E3DDD3]">
            {buyerBalances.map((order) => <li key={order.order_id} className="flex justify-between py-2 text-xs"><span>{order.order_code} · {order.buyer_name}</span><span>Received ₹{order.received_amount} · Due ₹{order.balance}</span></li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
