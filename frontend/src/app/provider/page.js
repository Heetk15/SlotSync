'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ProviderPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [form, setForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    duration_minutes: 30,
  });
  const [slots, setSlots] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Generate slots for your schedule.');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (user && user.role !== 'PROVIDER' && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const canQuery = Boolean(user && user.provider_id);

  const authorizedFetch = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Authenticate first.');

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Request failed.');

    return data;
  }, []);

  const loadSlots = useCallback(async () => {
    if (!user || !user.provider_id) return;

    const params = new URLSearchParams({ provider_id: user.provider_id });
    const data = await authorizedFetch(`/bookings/slots?${params.toString()}`, { method: 'GET' });
    setSlots(data);
  }, [user, authorizedFetch]);

  useEffect(() => {
    if (!canQuery) return;

    let cancelled = false;

    const fetchSlots = async () => {
      setBusy('load');
      try {
        await loadSlots();
        if (!cancelled) setStatusMessage('Slots refreshed.');
      } catch (error) {
        if (!cancelled) setStatusMessage(error.message);
      } finally {
        if (!cancelled) setBusy('');
      }
    };

    fetchSlots();

    return () => { cancelled = true; };
  }, [canQuery, loadSlots]);

  const generateSlots = async (event) => {
    event.preventDefault();
    if (!user || !user.provider_id) {
      setStatusMessage("No provider ID found for your account.");
      return;
    }

    setBusy('generate');
    setStatusMessage('');

    try {
      const data = await authorizedFetch('/providers/slots/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          provider_id: user.provider_id,
        }),
      });

      setStatusMessage(`Generated ${data.created_count} slots for ${data.date}.`);
      await loadSlots();
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const groupedSlots = useMemo(() => {
    const groups = {};
    slots.forEach(slot => {
      const dateStr = new Date(slot.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(slot);
    });
    
    // Sort dates
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));
    return sortedDates.map(date => ({
      date,
      slots: groups[date].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    }));
  }, [slots]);

  if (!user || (user.role !== 'PROVIDER' && user.role !== 'ADMIN')) return null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_30%,_#f8fafc_72%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">SlotSync Provider</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Slot generation workspace</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Generate availability windows and review the stored slots in a read-only list.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Status</p>
            <p className="mt-1 text-sm text-slate-700">{statusMessage}</p>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Authentication</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Active Session</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              You are authenticated as <span className="font-semibold">{user.username}</span>.
              <br />
              Your Provider ID is automatically linked.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={generateSlots} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm self-start">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Generation</p>
              <h2 className="text-lg font-semibold text-slate-950">Create availability slots</h2>
            </div>
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Duration (minutes)</span>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_minutes}
                    onChange={(event) => setForm((current) => ({ ...current, duration_minutes: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>End time</span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={!canQuery || busy === 'generate'}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'generate' ? 'Generating...' : 'Generate slots'}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Generated Slots</p>
                <h2 className="text-lg font-semibold text-slate-950">Read-only provider schedule</h2>
              </div>
              <button
                type="button"
                onClick={loadSlots}
                disabled={!canQuery || busy === 'load'}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'load' ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-6 space-y-8">
              {groupedSlots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No slots loaded for this provider yet.
                </div>
              ) : (
                groupedSlots.map((group) => (
                  <div key={group.date} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">{group.date}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.slots.map(slot => (
                        <div key={slot.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm hover:bg-white transition-colors">
                          <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-slate-900">
                              {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">ID: {slot.id.substring(0,8)}...</span>
                              <span className={[
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                                slot.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 
                                slot.status === 'BOOKED' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
                                'bg-amber-50 text-amber-700 ring-amber-200'
                              ].join(' ')}>
                                {slot.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}