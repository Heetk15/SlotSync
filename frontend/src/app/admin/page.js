'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [busy, setBusy] = useState('');
  const [appointmentTypeForm, setAppointmentTypeForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    active: true,
  });
  const [linkForm, setLinkForm] = useState({
    provider_id: '',
    appointment_type_id: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const loadApplications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/admin/applications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadApplications();
    }
  }, [user, loadApplications]);

  const postJson = async (path, body) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

  const approveApplication = async (appId) => {
    setBusy(appId);
    setStatusMessage('');
    try {
      await postJson(`/admin/applications/${appId}/approve`, {});
      setStatusMessage(`Application ${appId} approved.`);
      await loadApplications();
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eef4ff_35%,_#f8fafc_70%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">SlotSync Admin</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">System Control Console</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Manage provider applications, create service types, and connect them with the scheduling engine.
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1 mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pending Approvals</p>
            <h2 className="text-lg font-semibold text-slate-950">Provider Applications</h2>
          </div>
          
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No pending applications.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {applications.map((app) => (
                    <tr key={app.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{app.username}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(app.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => approveApplication(app.id)}
                          disabled={busy === app.id}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                        >
                          {busy === app.id ? 'Approving...' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Description</span>
                <textarea
                  value={appointmentTypeForm.description}
                  onChange={(event) => setAppointmentTypeForm((current) => ({ ...current, description: event.target.value }))}
                  rows="4"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
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
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
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
                disabled={busy === 'appointment-type'}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'appointment-type' ? 'Saving...' : 'Create appointment type'}
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Appointment Type ID</span>
                <input
                  type="text"
                  value={linkForm.appointment_type_id}
                  onChange={(event) => setLinkForm((current) => ({ ...current, appointment_type_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy === 'link'}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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