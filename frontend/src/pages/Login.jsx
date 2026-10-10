import React, { useState } from 'react';
import { Factory, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { API_BASE } from '../api';
import { AUTH_ROLES } from '../authRoles';

const DEMO_USERS = [
  {
    id: 'owner',
    name: 'Aarav Nair',
    label: 'Owner Executive',
    email: 'owner@everestmills.com',
    password: 'everest123',
    role: 'owner',
  },
  {
    id: 'inventory',
    name: 'Meena Kumar',
    label: 'Store Keeper',
    email: 'store@everestmills.com',
    password: 'store123',
    role: 'store_keeper',
  },
  {
    id: 'production',
    name: 'Raghul S.',
    label: 'Floor Supervisor',
    email: 'floor@everestmills.com',
    password: 'floor123',
    role: 'floor_supervisor',
  },
  {
    id: 'orders',
    name: 'Sundar Rao',
    label: 'Dispatch Head',
    email: 'dispatch@everestmills.com',
    password: 'dispatch123',
    role: 'dispatch',
  },
  {
    id: 'buyer',
    name: 'Kavya Raman',
    label: 'Buyer',
    email: 'buyer@everestmills.com',
    password: 'buyer123',
    role: 'buyer',
  },
];

export default function Login({ onLogin, selectedRole, onRoleChange, onSwitchToLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role: selectedRole }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      onLogin({ token: data.token, user: data.user });
    } catch (loginError) {
      setError(loginError.message || 'Unable to connect to the authentication service.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl grid overflow-hidden rounded-[32px] border border-[#E3DDD3] bg-[#FAF7F2] shadow-[0_25px_60px_-20px_rgba(42,53,40,0.18)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden bg-[#53634F] p-8 text-[#FAF7F2] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_45%)]" />
          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#E2E8E0]">Everest Textile Mills</div>
            <div className="mt-6 font-editorial text-5xl leading-none">mill operations</div>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#E2E8E0]">
              Unified production, inventory, dispatch, and profit visibility for every stage of the textile manufacturing lifecycle.
            </p>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
              <Factory className="h-5 w-5 text-[#DDD4C7]" />
              <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#DDD4C7]">Live floor</div>
              <div className="mt-2 font-editorial text-3xl">6 stages</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
              <ShieldCheck className="h-5 w-5 text-[#DDD4C7]" />
              <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#DDD4C7]">QC status</div>
              <div className="mt-2 font-editorial text-3xl">99.2%</div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-12">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#6C7B67]">Sign in</div>
              <h1 className="mt-2 font-editorial text-4xl text-[#2A3528]">Welcome back</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7ECE4] text-[#53634F]">
              <UserRound className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-xl border border-[#E3DDD3] bg-[#F1EEE9] p-1" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected="true"
              onClick={onSwitchToLogin}
              className="rounded-lg bg-[#53634F] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF7F2] shadow-sm"
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={onSwitchToRegister}
              className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#53634F] transition hover:bg-white/70"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-role" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Sign in to section
              </label>
              <select
                id="login-role"
                value={selectedRole}
                onChange={(event) => onRoleChange(event.target.value)}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
              >
                {AUTH_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-[#D9B8A4] bg-[#FFF3EE] px-3 py-2 text-sm text-[#8A4E3B]">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#53634F] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#FAF7F2] transition hover:bg-[#42503F]"
            >
              <LockKeyhole className="h-4 w-4" />
              Login to dashboard
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#6C7B67]">
            New here?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold text-[#53634F] underline-offset-4 hover:underline"
            >
              Create an account
            </button>
          </div>

          {import.meta.env.DEV && <div className="mt-8 rounded-2xl border border-[#E3DDD3] bg-[#F1EEE9] p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#6C7B67]">Demo access</div>
            <div className="mt-3 space-y-2 text-sm text-[#2A3528]">
              {DEMO_USERS.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2">
                  <div>
                    <div className="font-medium">{user.label}</div>
                    <div className="text-xs text-[#6C7B67]">{user.email}</div>
                  </div>
                  <div className="text-xs text-[#53634F]">{user.password}</div>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
