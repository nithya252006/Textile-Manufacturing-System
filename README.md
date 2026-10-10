# 🧵 Everest Textile Mills - Management System

A unified digital backbone built for Everest Textile Mills to replace paper notebooks, floor walking, and telephone calls with automated real-time workflows.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | **FastAPI (Python)** | High-speed REST APIs, automatic Swagger documentation (`/docs`) |
| **Database** | **SQLite + SQLAlchemy** | Zero-configuration database, pre-seeded models |
| **Frontend** | **React (Vite) + Tailwind CSS** | Real-time floor status, modals, responsive tables |
| **Charts** | **Recharts** | Interactive revenue, costs, and profit analytics |

---

## 🎯 PDF Problem Statement Mapped to Modules

1. **Scene 1: Yarn arrives at the gate** (`Person A: feature/inventory`)
   - Truck arrival gate entry (material type, color, lot number, quantity in kg).
   - Automated low-stock threshold alerts.
   - Pre-production material check calculator.

2. **Scene 2 & 3: Floor mid-shift & Quality Checks** (`Person B: feature/production`)
   - Machine status board (Spinning, Weaving, Dyeing - Running, Idle, Breakdown).
   - Fabric roll inspection slips (Pass, Rework, Reject) with defect logging (holes, color mismatch, uneven weaving).
   - End-to-end roll traceability to machine, shift operator, and order.

3. **Scene 4, 5 & 6: Orders, Dispatch & Owner Books** (`Person C: feature/orders-finance`)
   - Instant buyer call inquiry view with live completion progress.
   - Dispatch truck loading and invoice validation.
   - Owner Executive Dashboard: Revenue vs Costs (Yarn + Wages + Power) = Net Profit.

---

## 🚀 How to Run Locally

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The backend defaults to development mode for local use. Before starting it in PowerShell, configure a stable JWT secret and role invite codes:

```powershell
$env:APP_ENV = "development"
$env:JWT_SECRET_KEY = "replace-with-a-long-random-secret"
$env:OWNER_REGISTRATION_CODE = "owner-invite"
$env:STORE_KEEPER_REGISTRATION_CODE = "store-invite"
$env:FLOOR_SUPERVISOR_REGISTRATION_CODE = "floor-invite"
$env:DISPATCH_REGISTRATION_CODE = "dispatch-invite"
```

Buyer self-registration does not require an invite code. Owner and staff registration requires the matching server-side invite code. In production, set `APP_ENV=production` and provide a strong `JWT_SECRET_KEY`; the backend refuses to start without it. Demo accounts/data are seeded only in development. Do not deploy a database copied from development without removing or rotating its demo accounts and passwords.

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- App UI: [http://localhost:5173](http://localhost:5173)

To point the frontend at a backend running on a different host or port, create `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
```

Restart Vite after changing this value.

## 🔐 Accounts & Roles

Login and registration have separate section selectors. Owner Executive can open every role dashboard; each other role can access only its own dashboard and work area:

| Section | Role value | Workspace |
| :--- | :--- | :--- |
| Owner Executive | `owner` | Dashboard, inventory, production, and orders |
| Store Keeper | `store_keeper` | Inventory |
| Floor Supervisor | `floor_supervisor` | Production and QC |
| Dispatch Section | `dispatch` | Orders and dispatch |
| Buyer | `buyer` | The buyer's own orders |

Development-only seeded demo accounts:

| Section | Email | Password |
| :--- | :--- | :--- |
| Owner Executive | `owner@everestmills.com` | `everest123` |
| Store Keeper | `store@everestmills.com` | `store123` |
| Floor Supervisor | `floor@everestmills.com` | `floor123` |
| Dispatch Section | `dispatch@everestmills.com` | `dispatch123` |
| Buyer | `buyer@everestmills.com` | `buyer123` |

The API rejects login when the selected section does not match the account role. Passwords are stored as salted PBKDF2 hashes; API sessions use signed JWTs. API routes also enforce role permissions independently of the frontend navigation.

## ✅ Operations Rules

- Machine assignments require an existing order and machine; breakdown/maintenance machines, machines running another order, and dispatched orders cannot be assigned.
- Yarn can be reserved from matching-color lots for an order. Reserved kilograms are removed from free availability; production assignment consumes reserved stock exactly once.
- Machine status accepts `Idle`, `Running`, `Breakdown`, or `Maintenance` only.
- QC status accepts `Pending`, `Pass`, `Rework`, or `Reject`. Pending rolls do not contribute to the QC pass-rate denominator.
- Order progress is based on the total meters of QC-passed rolls, not the legacy `produced_meters` field.
- Dispatches contain selected, QC-passed rolls that have not been dispatched. The API calculates their count and meters, prevents duplicate/over-quantity dispatch, and records revenue only for shipped meters.
- Worker profiles, per-shift attendance, accrued wages, wage payments, supplier bills/payments, and buyer receipts are stored separately. Repeated attendance for the same worker/date/shift updates the row instead of duplicating it.
- The owner dashboard recognizes sales revenue from shipped meters and cash received from buyer-payment records. Costs use supplier invoices, recorded attendance wages, and machine-cost estimates; the dashboard labels machine/power as estimated until actual bills are recorded.

## 🧪 Manual Test Checklist

1. Start the backend and frontend using the commands above; verify the frontend loads and `/docs` is reachable.
2. Log in with each seeded staff account using its matching section. Confirm Store Keeper sees Inventory, Floor Supervisor sees Production, Dispatch sees Orders, and Owner sees all sections.
3. Try signing in with a valid account under the wrong section. Confirm the API rejects it with HTTP 403.
4. Register a buyer without an invite code. Confirm staff registration is rejected without its matching invite code, then test it with the configured code. Sign out and confirm each account can sign in only under its registered section.
5. Assign a valid order to an idle machine. Try an unknown order, an unknown machine, a machine in Breakdown/Maintenance, a machine already running a different order, and an already-dispatched order; each invalid assignment should be rejected.
6. Submit an unsupported machine status and QC status. Confirm request validation rejects each invalid value. Create a QC slip as Pending and confirm it does not inflate the pass rate.
7. Add QC-passed rolls and confirm order progress equals passed-roll meters divided by ordered meters, capped at 100%. Rework, Reject, and Pending rolls must not increase progress.
8. Dispatch a selected available roll. Confirm its meter count and invoice total are derived from the selected roll, and the roll disappears from available rolls and finished-goods inventory.
9. Try dispatching the same roll again and dispatching more meters than the order quantity. Confirm both are rejected and the shelf audit remains consistent.
10. Compare the owner dashboard with the dispatch/finance records. Unshipped orders must not count as revenue; an empty ledger must show zero revenue and costs.
11. Log in as Owner, add a worker, record present/absent attendance for a shift, and confirm only Present creates accrued wages. Re-saving the same worker/date/shift should update the record, not duplicate it.
12. Record partial worker and supplier payments and confirm balances decrease; try to pay more than the balance and confirm rejection. Record partial buyer receipts and confirm buyer receivables decrease independently from shipment revenue.
13. Log yarn intake with supplier invoice number and total. Confirm the bill is visible in Payroll & Settlements; log a supplier payment and verify paid/balance totals.
14. Reserve a matching-color yarn allocation for an order. Confirm free kilograms decrease and the lot lists its reserved order. Attempt another reservation beyond free stock and confirm rejection; assign the order to an idle machine and confirm the reservation is consumed and physical stock decreases once.

---

## 🌿 Git Branching Workflow for Teammates

### After base setup is on `main`:
Teammates should update their branches:
```bash
git checkout feature/inventory       # (or feature/production or feature/orders-finance)
git merge main
```
Push changes to your feature branch:
```bash
git push origin feature/<your-feature-name>
```