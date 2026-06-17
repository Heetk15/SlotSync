'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchMySlots(token) {
  const response = await fetch(`${API_URL}/bookings/my-slots`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Failed to load your appointments.');
  }

  return response.json();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function classifySlot(slot) {
  if (slot.status === 'HELD') return 'waitlisted';
  if (slot.status === 'BOOKED') return 'upcoming';
  return 'completed';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [toast, setToast] = useState({ type: '', message: '' });
  const [cancellingId, setCancellingId] = useState('');
  const [applying, setApplying] = useState(false);

  const groupedSlots = useMemo(() => {
    return slots.reduce(
      (groups, slot) => {
        const bucket = classifySlot(slot);
        groups[bucket].push(slot);
        return groups;
      },
      { upcoming: [], waitlisted: [], completed: [], cancelled: [] }
    );
  }, [slots]);

  const tabMeta = useMemo(() => ([
    { key: 'upcoming', label: 'Upcoming', count: groupedSlots.upcoming.length },
    { key: 'waitlisted', label: 'Waitlisted', count: groupedSlots.waitlisted.length },
    { key: 'completed', label: 'Completed', count: groupedSlots.completed.length },
    { key: 'cancelled', label: 'Cancelled', count: groupedSlots.cancelled.length },
  ]), [groupedSlots]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const data = await fetchMySlots(token);
      setSlots(data);
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
    const intervalId = setInterval(() => {
      void loadDashboard();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [loadDashboard, user]);

  const handleCancel = async (slot) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setCancellingId(slot.id);
    setToast({ type: '', message: '' });
    setSlots((currentSlots) => currentSlots.filter((s) => s.id !== slot.id));

    try {
      const response = await fetch(`${API_URL}/bookings/${slot.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Cancellation failed.');

      setToast({ type: 'success', message: 'Appointment cancelled.' });
      await loadDashboard();
    } catch (error) {
      setToast({ type: 'error', message: error.message });
      await loadDashboard();
    } finally {
      setCancellingId('');
    }
  };

  const handleApplyProvider = async () => {
    setApplying(true);
    try {
      const response = await fetch(`${API_URL}/users/apply-provider`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to apply.');
      }
      setToast({ type: 'success', message: 'Application submitted successfully! It is under review.' });
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setApplying(false);
    }
  };

  const renderEmptyState = (message) => (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );

  const emptyStateMessage = {
    upcoming: 'No upcoming appointments found.',
    waitlisted: 'No waitlisted appointments found.',
    completed: 'No completed appointments yet.',
    cancelled: 'No cancelled appointments yet.',
  };

  const renderSlots = (sectionKey) => {
    const sectionSlots = groupedSlots[sectionKey];
    if (sectionSlots.length === 0) return renderEmptyState(emptyStateMessage[sectionKey]);

    return (
      <div className="space-y-3">
        {sectionSlots.map((slot) => {
          const canCancel = sectionKey === 'upcoming' || sectionKey === 'waitlisted';
          const isBusy = cancellingId === slot.id;

          return (
            <article key={slot.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{formatDateTime(slot.start_time)}</h3>
                    <span className={[
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                      sectionKey === 'upcoming' ? 'bg-emerald-50 text-emerald-700' :
                      sectionKey === 'waitlisted' ? 'bg-amber-50 text-amber-700' :
                      sectionKey === 'completed' ? 'bg-slate-100 text-slate-600' :
                      'bg-rose-50 text-rose-700',
                    ].join(' ')}>
                      {sectionKey}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">Slot ID: {slot.id}</p>
                </div>
                {canCancel && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleCancel(slot)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy ? 'Cancelling...' : 'Cancel Appointment'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  if (!user) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-3 border-b border-slate-200 pb-6 flex justify-between items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <Link href="/" className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
                Home
              </Link>
              <span>/</span>
              <span>Dashboard</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl mt-3">Your schedule</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Review upcoming appointments, monitor waitlisted items, and keep your scheduling state tidy.
            </p>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Authenticated User</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{user.id}</h2>
            <p className="mt-1 text-sm text-slate-600">Role: {user.role}</p>
          </div>
          <div className="flex items-center justify-end gap-4">
            {user.role === 'USER' && (
              <button
                onClick={handleApplyProvider}
                disabled={applying}
                className="rounded-xl border border-indigo-600 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              >
                {applying ? 'Applying...' : 'Apply to be a Provider'}
              </button>
            )}
            <button
              type="button"
              onClick={loadDashboard}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tabMeta.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20',
                  activeTab === tab.key
                    ? 'border-[#0f62fe] bg-[#f5f8ff] shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="text-sm font-medium text-slate-500">{tab.label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{tab.count}</div>
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {tabMeta.find((tab) => tab.key === activeTab)?.label}
                </h2>
                <p className="text-sm text-slate-500">Manage active state from one place.</p>
              </div>
            </div>
            {renderSlots(activeTab)}
          </section>
        )}
      </div>

      {toast.message && (
        <div
          className={[
            'fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-lg',
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{toast.message}</p>
            <button type="button" onClick={() => setToast({ type: '', message: '' })} className="text-sm font-semibold">
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
