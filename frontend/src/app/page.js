'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSlotSocket } from '../hooks/useSlotSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function SlotSyncDashboard() {
  const [slotId, setSlotId] = useState('');
  const [userId, setUserId] = useState('user_001');
  const [actionStatus, setActionStatus] = useState({ type: 'idle', message: '' });
  const { slotState, wsStatus, waitlistCount } = useSlotSocket(slotId);

  const triggerBooking = async () => {
    if (!slotId) {
      setActionStatus({ type: 'error', message: 'Target Slot UUID is required.' });
      return;
    }

    setActionStatus({ type: 'processing', message: 'Authenticating and acquiring distributed locks...' });

    try {
      const authRes = await fetch(`${API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!authRes.ok) throw new Error('Authentication gateway failed.');
      const { access_token } = await authRes.json();

      const response = await fetch(`${API_URL}/bookings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          slot_id: slotId,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setActionStatus({ type: 'error', message: `Rate limit triggered: ${data.detail}` });
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Transaction failed');
      }

      setActionStatus({
        type: 'success',
        message: `Transaction verified: ${data.message} (${data.status})`,
      });
    } catch (err) {
      setActionStatus({ type: 'error', message: `System error: ${err.message}` });
    }
  };

  const triggerCancellation = async () => {
    if (!slotId) return;
    setActionStatus({ type: 'processing', message: 'Authenticating and propagating cancellation sequence...' });

    try {
      const authRes = await fetch(`${API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!authRes.ok) throw new Error('Authentication gateway failed.');
      const { access_token } = await authRes.json();

      const response = await fetch(`${API_URL}/bookings/${slotId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail);

      setActionStatus({ type: 'success', message: 'Slot freed. Waitlist promotion worker dispatched.' });
    } catch (err) {
      setActionStatus({ type: 'error', message: `Cancellation failed: ${err.message}` });
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_38%,_#f8fafc_76%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">SlotSync Control Center</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Real-time booking operations</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              A lightweight operator console for transaction verification, cancellations, and live state inspection.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">WebSocket</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <span className={`h-2.5 w-2.5 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <span>{wsStatus}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Target Configuration</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Select a slot and user identity</h2>
            </div>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              <span>Target Slot UUID</span>
              <input
                type="text"
                value={slotId}
                onChange={(e) => setSlotId(e.target.value.trim())}
                placeholder="Paste slot ID here..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              <span>Client User Identity</span>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value.trim())}
                placeholder="User identifier..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Live Engine Telemetry</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Current stream state</h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className={`text-3xl font-semibold tracking-tight ${slotState.status === 'BOOKED' ? 'text-rose-600' : slotState.status === 'AVAILABLE' ? 'text-emerald-600' : slotState.status === 'WAITLISTED' ? 'text-amber-600' : 'text-slate-400'}`}>
                {slotState.status}
              </p>
              <p className="mt-1 text-sm text-slate-600">{slotState.message}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>In-memory Redis waitlist</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">{waitlistCount || 0}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Transaction Orchestration</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Core booking actions</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={triggerBooking}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              Dispatch Booking Request
            </button>
            <button
              onClick={triggerCancellation}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20"
            >
              Release Slot (Trigger Cascade)
            </button>
          </div>

          {actionStatus.message ? (
            <div
              className={[
                'rounded-2xl border px-4 py-3 text-sm',
                actionStatus.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : actionStatus.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600',
              ].join(' ')}
            >
              {actionStatus.message}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
