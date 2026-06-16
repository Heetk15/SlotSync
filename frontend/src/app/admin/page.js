'use client';

import { useMemo, useState } from 'react';

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

export default function AdminPage() {
  const [authUserId, setAuthUserId] = useState('admin_001');
  const [authToken, setAuthToken] = useState('');
  const [authMessage, setAuthMessage] = useState('Authenticate to enable API actions.');
  const [busy, setBusy] = useState('');
  const [appointmentTypeForm, setAppointmentTypeForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    active: true,
  });
  const [providerForm, setProviderForm] = useState({
    user_id: '',
    name: '',
    description: '',
    active: true,
  });
  const [linkForm, setLinkForm] = useState({
    provider_id: '',
    appointment_type_id: '',
  });
  const [statusMessage, setStatusMessage] = useState('');

  const canMutate = useMemo(() => Boolean(authToken), [authToken]);

  const authenticate = async () => {
    setBusy('auth');
    setStatusMessage('');
    try {
      const token = await fetchAccessToken(authUserId.trim());
      setAuthToken(token);
      setAuthMessage(`Authenticated as ${authUserId.trim()}.`);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const postJson = async (path, body) => {
    if (!authToken) {
      throw new Error('Authenticate first.');
    }

    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Request failed.');
    }

    return data;
  };

  const createAppointmentType = async (event) => {
    event.preventDefault();
    setBusy('appointment-type');
    setStatusMessage('');
    try {
      const data = await postJson('/admin/appointment-types', appointmentTypeForm);
      setStatusMessage(`Appointment type created: ${data.name}`);
      setLinkForm((current) => ({ ...current, appointment_type_id: data.id }));
      setAppointmentTypeForm({
        name: '',
        description: '',
        duration_minutes: 30,
        active: true,
      });
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const createProvider = async (event) => {
    event.preventDefault();
    setBusy('provider');
    setStatusMessage('');
    try {
      const data = await postJson('/admin/providers', providerForm);
      setStatusMessage(`Provider created: ${data.name}`);
      setLinkForm((current) => ({ ...current, provider_id: data.id }));
      setProviderForm({
        user_id: '',
        name: '',
        description: '',
        active: true,
      });
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const linkProviderType = async (event) => {
    event.preventDefault();
    setBusy('link');
    setStatusMessage('');
    try {
      const data = await postJson(`/admin/providers/${linkForm.provider_id}/types`, {
        appointment_type_id: linkForm.appointment_type_id,
      });
      setStatusMessage(`Linked provider ${data.provider_id} to appointment type ${data.appointment_type_id}.`);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eef4ff_35%,_#f8fafc_70%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">SlotSync Admin</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Setup and generation control</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Create appointment types, register providers, and connect them with the clean operational flow used by the booking engine.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">API Status</p>
            <p className="mt-1 text-sm text-slate-700">{authMessage}</p>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Authentication</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Bearer token</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Authenticate once to attach the token to every admin request.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">
              <span>User ID</span>
              <input
                type="text"
                value={authUserId}
                onChange={(event) => setAuthUserId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
              />
            </label>
            <button
              type="button"
              onClick={authenticate}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy === 'auth'}
            >
              {busy === 'auth' ? 'Authenticating...' : authToken ? 'Refresh token' : 'Authenticate'}
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={createAppointmentType} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Appointment Types</p>
              <h2 className="text-lg font-semibold text-slate-950">Create service type</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Name</span>
                <input
                  type="text"
                  value={appointmentTypeForm.name}
                  onChange={(event) => setAppointmentTypeForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Description</span>
                <textarea
                  value={appointmentTypeForm.description}
                  onChange={(event) => setAppointmentTypeForm((current) => ({ ...current, description: event.target.value }))}
                  rows="4"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  <span>Duration</span>
                  <input
                    type="number"
                    min="1"
                    value={appointmentTypeForm.duration_minutes}
                    onChange={(event) => setAppointmentTypeForm((current) => ({ ...current, duration_minutes: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                    required
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={appointmentTypeForm.active}
                    onChange={(event) => setAppointmentTypeForm((current) => ({ ...current, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Active
                </label>
              </div>
              <button
                type="submit"
                disabled={!canMutate || busy === 'appointment-type'}
                className="w-full rounded-xl bg-[#0f62fe] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b57e3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'appointment-type' ? 'Saving...' : 'Create appointment type'}
              </button>
            </div>
          </form>

          <form onSubmit={createProvider} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Providers</p>
              <h2 className="text-lg font-semibold text-slate-950">Create provider profile</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>User ID</span>
                <input
                  type="text"
                  value={providerForm.user_id}
                  onChange={(event) => setProviderForm((current) => ({ ...current, user_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Name</span>
                <input
                  type="text"
                  value={providerForm.name}
                  onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Description</span>
                <textarea
                  value={providerForm.description}
                  onChange={(event) => setProviderForm((current) => ({ ...current, description: event.target.value }))}
                  rows="4"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/20 focus:bg-white"
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={providerForm.active}
                  onChange={(event) => setProviderForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active
              </label>
              <button
                type="submit"
                disabled={!canMutate || busy === 'provider'}
                className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'provider' ? 'Saving...' : 'Create provider'}
              </button>
            </div>
          </form>

          <form onSubmit={linkProviderType} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Relationships</p>
              <h2 className="text-lg font-semibold text-slate-950">Link provider to type</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Provider ID</span>
                <input
                  type="text"
                  value={linkForm.provider_id}
                  onChange={(event) => setLinkForm((current) => ({ ...current, provider_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Appointment Type ID</span>
                <input
                  type="text"
                  value={linkForm.appointment_type_id}
                  onChange={(event) => setLinkForm((current) => ({ ...current, appointment_type_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={!canMutate || busy === 'link'}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'link' ? 'Linking...' : 'Create association'}
              </button>
            </div>
          </form>
        </div>

        {statusMessage ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {statusMessage}
          </div>
        ) : null}
      </div>
    </main>
  );
}