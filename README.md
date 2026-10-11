# Everest Textile Mills Management System

A full-stack textile manufacturing management application built to digitalize yarn intake, production tracking, quality checks, dispatch, and owner-level financial operations for Everest Textile Mills.

## Overview

This project replaces manual production tracking and paper-based reporting with a unified workflow that covers:
- Yarn gate entry and stock monitoring
- Production machine status and assignment
- Quality inspection and roll traceability
- Buyer orders and dispatch management
- Payroll, supplier bills, and buyer receivables
- Profit and cost dashboard for the owner

## Tech Stack

| Layer | Stack | Purpose |
| --- | --- | --- |
| Backend | FastAPI + SQLAlchemy + Alembic | API layer, business logic, versioned schema migrations |
| Database | SQLite locally; PostgreSQL in production | Persistent application data |
| Frontend | React + Vite | Role-based dashboards and operations UI |
| Auth | JWT + password hashing | Secure login and section-based access |
| Charts | Recharts | Revenue, cost, and profit analytics |

## Mapping to the Problem Statement

### Scene 1: Yarn arrival and stock intake
- Gate entry for yarn lots with quantity, color, and lot number
- Low-stock threshold and material sufficiency checks
- Supplier invoice and payment tracking

### Scene 2 and 3: Floor and quality control
- Machine board for Spinning, Weaving, and Dyeing
- Status values: Idle, Running, Breakdown, Maintenance
- Fabric roll QC states: Pending, Pass, Rework, Reject
- Traceability from machine to order and product roll

### Scene 4, 5 and 6: Orders, dispatch, and owner books
- Buyer order booking and live status tracking
- Roll selection for dispatch and invoice generation
- Profit, cost, wages, and receivables dashboard

## Project Structure

```text
backend/
  auth.py
  alembic/
    versions/
  database.py
  main.py
  models.py
  requirements.txt
  requirements-dev.txt
  routers/
    accounting.py
    inventory.py
    orders_finance.py
    production.py

frontend/
  src/
  package.json
  vite.config.js
```

## Run Instructions

### 1) Backend
```bash
cd backend
pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

For a local database created by an earlier version of this project, back up `textile_factory.db` first, then mark the matching baseline and apply the role migration:

```bash
python -m alembic stamp 6e658d8b4ff4
python -m alembic upgrade head
```

API docs: http://127.0.0.1:8000/docs

Optional environment setup for PowerShell:
```powershell
$env:APP_ENV = "development"
$env:JWT_SECRET_KEY = "replace-with-a-long-random-secret"
$env:OWNER_REGISTRATION_CODE = "owner-invite"
$env:STORE_KEEPER_REGISTRATION_CODE = "store-invite"
$env:FLOOR_SUPERVISOR_REGISTRATION_CODE = "floor-invite"
$env:DISPATCH_REGISTRATION_CODE = "dispatch-invite"
```

### 2) Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Application URL: http://localhost:5173

If needed, create a frontend/.env file:
```env
VITE_API_URL=http://localhost:8000
```

## Roles and Access

| Role | Value | Access |
| --- | --- | --- |
| Owner Executive | owner | Full dashboard and all modules |
| Store Keeper | store_keeper | Inventory |
| Floor Supervisor | floor_supervisor | Production and QC |
| Dispatch Section | dispatch | Orders and dispatch |
| Buyer | buyer | Own order tracking |

## Demo Accounts (Development Only)

| Role | Email | Password |
| --- | --- | --- |
| Owner Executive | owner@everestmills.com | everest123 |
| Store Keeper | store@everestmills.com | store123 |
| Floor Supervisor | floor@everestmills.com | floor123 |
| Dispatch Section | dispatch@everestmills.com | dispatch123 |
| Buyer | buyer@everestmills.com | buyer123 |

## Verified Project Status

The project has been validated for:
- backend compilation
- frontend build success
- live FastAPI response on port 8000
- successful login flow using the seeded owner account
- automated auth and health API tests
- Alembic upgrade and schema drift checks on SQLite

This confirms that the application architecture, API wiring, and frontend-to-backend connection are operational.

## Manual Test Checklist

1. Launch backend and frontend.
2. Open the app and log in with a seeded user.
3. Confirm the selected role matches the account section.
4. Check dashboard access and role-specific modules.
5. Validate machine assignment, QC update, and order progress logic.
6. Dispatch a QC-passed roll and verify invoice/profit calculations.
7. Test attendance, wages, supplier bills, and buyer payment flows.
8. Verify yarn reservation and stock reduction behavior.

## Notes

- Development data is pre-seeded for demo use only; production never receives demo users or sample records.
- The backend enforces role permissions independently of the frontend UI.
- Production requires PostgreSQL, a strong JWT secret, secure invite codes, and explicit frontend CORS origins.

## Deployment

The repository includes a Render Blueprint at `render.yaml` and Vercel SPA routing at `frontend/vercel.json`. Use Neon for PostgreSQL and deploy the API and frontend separately.

### 1. Create PostgreSQL

1. Create a Neon project and database.
2. Copy the database connection string from Neon. Use the direct connection string and keep it private; do not add it to source files or commit it.

The application still defaults to SQLite for local development. Render sets `APP_ENV=production`, which requires a PostgreSQL `DATABASE_URL`; it will not silently start on SQLite. Use Neon’s pooled URL for `DATABASE_URL` (runtime traffic) and its direct/unpooled URL for `MIGRATION_DATABASE_URL` (Alembic startup migrations).

### 2. Deploy the API on Render

1. Push the repository to GitHub, then create a Render Blueprint from that repository. Render reads the root `render.yaml` and creates the Python web service.
2. When prompted, enter Neon’s pooled connection string for `DATABASE_URL` and its direct/unpooled connection string for `MIGRATION_DATABASE_URL`. For initial `CORS_ORIGINS`, enter a temporary valid origin such as `https://example.invalid`; replace it with the Vercel URL after the frontend is deployed.
3. Render generates the JWT secret and staff invite codes. Keep those values private. Buyer registration is open; owner and staff accounts require their corresponding invite codes.
4. The start command runs `python -m alembic upgrade head` before Uvicorn, and Render checks `/health`.

After the service deploys, note its public base URL, for example `https://textile-manufacturing-api.onrender.com`.

### 3. Deploy the frontend on Vercel

1. Import the same GitHub repository as a Vercel project and set the project root to `frontend/`.
2. Use `npm ci` to install, `npm run build` to build, and `dist` as the output directory.
3. Set the build environment variable `VITE_API_URL` to the Render API base URL, with no trailing slash, then deploy.
4. Note the Vercel site origin, for example `https://textile-manufacturing-system.vercel.app`.

The Vercel configuration rewrites `/login` and `/register` to the React entry page so refreshing those client-side paths works.

### 4. Connect and Verify

1. In Render, replace the temporary `CORS_ORIGINS` value with the exact Vercel origin (scheme and host only; no path or trailing slash), then save/redeploy.
2. Open `https://<render-service>.onrender.com/health`; expect HTTP 200 and `{"status":"ok",...}`.
3. Register the owner account using the private `OWNER_REGISTRATION_CODE`, then test login and role-protected workflows from the Vercel site.
4. Check `/docs` on the Render service for API diagnostics.

Do not use the development demo credentials in production. Demo users and sample rows are only seeded when `APP_ENV=development`.

### Existing Local Data

Alembic creates and updates the database schema; it does not copy rows from the local SQLite file to PostgreSQL. To preserve local records, create a new, empty PostgreSQL database and run the guarded transfer from `backend/`:

```powershell
cd backend
$env:SQLITE_DATABASE_URL = "sqlite:///./textile_factory.db"
Copy-Item migration-passwords.example.json migration-passwords.json
# Edit migration-passwords.json locally with new passwords (12+ chars).
python migrate_sqlite_to_postgres.py
```

The script prompts for `DATABASE_URL` with hidden input if it is not set in the environment. It reads seeded-account password replacements from the ignored `migration-passwords.json`, removes that file after a successful transfer, and retains it after a failure so you can retry. It applies the current Alembic migrations, refuses to copy into a database with existing application rows, copies the SQLite records and IDs, adjusts PostgreSQL ID sequences, and leaves the SQLite source unchanged. Save the new account passwords securely. Do not commit the populated password file or point the tool at a PostgreSQL database that already contains important data.

### Ongoing Schema Changes

After changing SQLAlchemy models, create and inspect a revision before deployment:

```bash
cd backend
python -m alembic revision --autogenerate -m "describe schema change"
python -m alembic upgrade head
```

## Git Workflow

```bash
git checkout feature/inventory
git merge main
git push origin feature/inventory
```
