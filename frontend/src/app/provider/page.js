'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchAccessToken(userId) {
  const response = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Authentication failed.');
  }

  const data = await response.json();
  return data.access_token;
}

export default function ProviderPage() {
  const [authUserId, setAuthUserId] = useState('provider_001');
  const [authToken, setAuthToken] = useState('');
  const [providerId, setProviderId] = useState('');
  const [form, setForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    duration_minutes: 30,
  });
  const [slots, setSlots] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Authenticate, choose a provider, and generate slots.');
  const [busy, setBusy] = useState('');

  const canQuery = useMemo(() => Boolean(authToken && providerId), [authToken, providerId]);

  const authenticate = async () => {
    setBusy('auth');
    setStatusMessage('');
    try {
      const token = await fetchAccessToken(authUserId.trim());
      setAuthToken(token);
      setStatusMessage(`Authenticated as ${authUserId.trim()}.`);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const authorizedFetch = useCallback(async (path, options = {}) => {
    if (!authToken) {
      throw new Error('Authenticate first.');
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Request failed.');
    }

    return data;
  }, [authToken]);

  const loadSlots = useCallback(async () => {
    if (!authToken || !providerId.trim()) {
      return;
    }

    const params = new URLSearchParams({ provider_id: providerId.trim() });
    const data = await authorizedFetch(`/bookings/slots?${params.toString()}`, { method: 'GET' });
    setSlots(data);
  }, [authToken, providerId, authorizedFetch]);

  useEffect(() => {
    if (!canQuery) {
      return;
    }

    let cancelled = false;

    const fetchSlots = async () => {
      setBusy('load');
      try {
        await loadSlots();

        if (!cancelled) {
          setStatusMessage('Slots refreshed.');
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(error.message);
        }
      } finally {
        if (!cancelled) {
          setBusy('');
        }
      }
    };

    fetchSlots();

    return () => {
      cancelled = true;
    };
  }, [canQuery, loadSlots]);

  const generateSlots = async (event) => {
    event.preventDefault();
    setBusy('generate');
    setStatusMessage('');

    try {
      const data = await authorizedFetch('/providers/slots/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          provider_id: providerId,
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_30%,_#f8fafc_72%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">SlotSync Provider</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Slot generation workspace</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Generate availability windows for a single provider and review the stored slots in a read-only list.
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
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Bearer token</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Attach the token to every provider request before loading or generating slots.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">
              <span>User ID</span>
              <input
                type="text"
                value={authUserId}
                onChange={(event) => setAuthUserId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
            <button
              type="button"
              onClick={authenticate}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy === 'auth'}
            >
              {busy === 'auth' ? 'Authenticating...' : authToken ? 'Refresh token' : 'Authenticate'}
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={generateSlots} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Generation</p>
              <h2 className="text-lg font-semibold text-slate-950">Create availability slots</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Provider ID</span>
                <input
                  type="text"
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Duration</span>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_minutes}
                    onChange={(event) => setForm((current) => ({ ...current, duration_minutes: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
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
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>End time</span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={!canQuery || busy === 'generate'}
                className="w-full rounded-xl bg-[#0f62fe] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b57e3] disabled:cursor-not-allowed disabled:opacity-60"
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
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'load' ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {slots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No slots loaded for this provider yet.
                </div>
              ) : (
                slots.map((slot) => (
                  <div key={slot.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(slot.start_time).toLocaleString()} - {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-slate-500">Slot ID: {slot.id}</p>
                      </div>
                      <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 ring-1 ring-inset ring-slate-200">
                        {slot.status}
                      </span>
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