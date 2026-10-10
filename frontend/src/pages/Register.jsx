import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Factory, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { API_BASE } from '../api';
import { AUTH_ROLES } from '../authRoles';

export default function Register({ onRegister, selectedRole, onRoleChange, onSwitchToLogin, onSwitchToRegister }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    registration_code: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all the required fields.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: selectedRole,
          registration_code: form.registration_code || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccess('Account created successfully. Redirecting to the dashboard...');
      onRegister({ token: data.token, user: data.user });
    } catch (registerError) {
      setError(registerError.message || 'Unable to create account right now.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl grid overflow-hidden rounded-[32px] border border-[#E3DDD3] bg-[#FAF7F2] shadow-[0_25px_60px_-20px_rgba(42,53,40,0.18)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden bg-[#53634F] p-8 text-[#FAF7F2] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_45%)]" />
          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#E2E8E0]">New account</div>
            <div className="mt-6 font-editorial text-5xl leading-none">create your mill profile</div>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#E2E8E0]">
              Register to access production, inventory monitoring, shipping updates, and real-time business intelligence.
            </p>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
              <Factory className="h-5 w-5 text-[#DDD4C7]" />
              <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#DDD4C7]">Operations</div>
              <div className="mt-2 font-editorial text-3xl">Live</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
              <ShieldCheck className="h-5 w-5 text-[#DDD4C7]" />
              <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#DDD4C7]">Access</div>
              <div className="mt-2 font-editorial text-3xl">Secure</div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-12">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#6C7B67]">Register</div>
              <h1 className="mt-2 font-editorial text-4xl text-[#2A3528]">Create account</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7ECE4] text-[#53634F]">
              <UserRoundPlus className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-xl border border-[#E3DDD3] bg-[#F1EEE9] p-1" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={onSwitchToLogin}
              className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#53634F] transition hover:bg-white/70"
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="true"
              onClick={onSwitchToRegister}
              className="rounded-lg bg-[#53634F] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF7F2] shadow-sm"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
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
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
                placeholder="Create a password"
              />
            </div>

            <div>
              <label htmlFor="role" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                Register for section
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(event) => onRoleChange(event.target.value)}
                className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
              >
                {AUTH_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>

            {selectedRole !== 'buyer' && (
              <div>
                <label htmlFor="registration_code" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#6C7B67]">
                  Staff invite code
                </label>
                <input
                  id="registration_code"
                  name="registration_code"
                  type="password"
                  required
                  value={form.registration_code}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-[#E3DDD3] bg-white px-4 py-3 text-sm text-[#2A3528] outline-none transition focus:border-[#53634F] focus:ring-4 focus:ring-[#53634F]/10"
                  placeholder="Enter the code provided by mill management"
                />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-[#D9B8A4] bg-[#FFF3EE] px-3 py-2 text-sm text-[#8A4E3B]">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#A5C9A9] bg-[#F0F8F1] px-3 py-2 text-sm text-[#3B5D42]">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#53634F] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#FAF7F2] transition hover:bg-[#42503F]"
            >
              Register now
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#6C7B67]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-semibold text-[#53634F] underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
