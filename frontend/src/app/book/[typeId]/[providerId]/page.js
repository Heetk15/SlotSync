'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SIMULATED_USER_ID = 'consumer_001';

function formatDateLabel(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00`));
}

function formatTimeLabel(isoValue) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoValue));
}

function groupSlotsByDate(slots) {
  return slots.reduce((groups, slot) => {
    const dateKey = slot.start_time.slice(0, 10);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(slot);
    return groups;
  }, {});
}

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

export default function ProviderSchedulePage({ params }) {
  const [authToken, setAuthToken] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlotId, setBookingSlotId] = useState('');
  const [toast, setToast] = useState({ type: '', message: '' });

  const groupedSlots = useMemo(() => groupSlotsByDate(slots), [slots]);
  const orderedDates = useMemo(() => Object.keys(groupedSlots).sort((a, b) => a.localeCompare(b)), [groupedSlots]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  const fetchSlots = useCallback(async (token) => {
    const response = await fetch(`${API_URL}/bookings/slots?provider_id=${params.providerId}`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || 'Failed to load provider slots.');
    }

    return response.json();
  }, [params.providerId]);

  const refreshSlots = async (token = authToken) => {
    const data = await fetchSlots(token);
    setSlots(data);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const token = await fetchAccessToken(SIMULATED_USER_ID);
        if (cancelled) {
          return;
        }

        setAuthToken(token);
        const data = await fetchSlots(token);
        if (!cancelled) {
          setSlots(data);
          setToast({ type: '', message: '' });
        }
      } catch (error) {
        if (!cancelled) {
          showToast('error', error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [params.providerId, fetchSlots]);

  const handleRefresh = async () => {
    if (!authToken) {
      return;
    }

    setLoading(true);
    try {
      await refreshSlots();
      showToast('success', 'Availability refreshed.');
    } catch (error) {
      showToast('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slot) => {
    if (!authToken || slot.status !== 'AVAILABLE') {
      return;
    }

    setBookingSlotId(slot.id);
    showToast('', '');

    setSlots((currentSlots) => currentSlots.map((currentSlot) => (
      currentSlot.id === slot.id ? { ...currentSlot, status: 'BOOKING...' } : currentSlot
    )));

    try {
      const response = await fetch(`${API_URL}/bookings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          slot_id: slot.id,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Booking failed.');
      }

      showToast('success', data.message || 'Slot booked successfully.');
      await refreshSlots();
    } catch (error) {
      showToast('error', error.message);
      await refreshSlots();
    } finally {
      setBookingSlotId('');
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_35%,_#f8fafc_75%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <Link href="/book" className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
              Services
            </Link>
            <span>/</span>
            <Link href={`/book/${params.typeId}`} className="font-medium text-[#0f62fe] transition hover:text-[#0b57e3]">
              Providers
            </Link>
            <span>/</span>
            <span>Schedule</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Select a time</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Available times are grouped by date. Click an open slot to book it instantly.
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Provider</p>
            <h2 className="text-xl font-semibold text-slate-950">{params.providerId}</h2>
            <p className="text-sm text-slate-600">Signed in as a simulated consumer identity.</p>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!authToken || loading}
            >
              Refresh slots
            </button>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((__, buttonIndex) => (
                      <div key={buttonIndex} className="h-10 animate-pulse rounded-xl bg-slate-200" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : orderedDates.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <p className="text-base font-medium text-slate-900">No slots found for this provider.</p>
            <p className="mt-2 text-sm text-slate-600">Please check another date or return to the provider list.</p>
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {orderedDates.map((dateKey) => (
              <article key={dateKey} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{formatDateLabel(dateKey)}</p>
                    <p className="mt-1 text-sm text-slate-600">{groupedSlots[dateKey].length} time slots</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {groupedSlots[dateKey]
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((slot) => {
                      const isAvailable = slot.status === 'AVAILABLE';
                      const isHeldOrBooked = slot.status === 'BOOKED' || slot.status === 'HELD';
                      const isBooking = bookingSlotId === slot.id;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isAvailable || isBooking}
                          onClick={() => handleBookSlot(slot)}
                          className={[
                            'rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#0f62fe]/20',
                            isAvailable && !isBooking
                              ? 'border border-slate-300 bg-white text-slate-800 hover:border-[#0f62fe] hover:text-[#0f62fe]'
                              : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400',
                            isBooking ? 'opacity-70' : '',
                          ].join(' ')}
                        >
                          {isBooking ? 'Booking...' : formatTimeLabel(slot.start_time)}
                          {isHeldOrBooked ? <span className="sr-only">unavailable</span> : null}
                        </button>
                      );
                    })}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {toast.message ? (
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
      ) : null}
    </main>
  );
}
