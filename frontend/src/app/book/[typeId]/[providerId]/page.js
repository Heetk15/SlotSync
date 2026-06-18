'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useSlotSocket } from '@/hooks/useSlotSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function SlotButton({ slot, onSelect }) {
  const { slotState } = useSlotSocket(slot.id);
  
  // Real-time status trumps the initial loaded status
  const currentStatus = slotState.status !== 'AWAITING CONNECTION...' ? slotState.status : slot.status;
  
  const isAvailable = currentStatus === 'AVAILABLE';
  const isBooked = currentStatus === 'BOOKED' || currentStatus === 'HELD';
  
  if (isBooked) {
    return (
      <button
        onClick={() => onSelect(slot, true)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="line-through opacity-70">
            {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs font-semibold text-slate-600">Join Waitlist</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(slot, false)}
      className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </button>
  );
}

export default function BookingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  
  const providerId = params.providerId;
  
  const [provider, setProvider] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  
  const [modalSlot, setModalSlot] = useState(null);
  const [isWaitlistModal, setIsWaitlistModal] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

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

  const loadData = useCallback(async () => {
    try {
      const providerData = await authorizedFetch(`/providers/${providerId}`, { method: 'GET' });
      setProvider(providerData);

      const searchParams = new URLSearchParams({ provider_id: providerId });
      const slotsData = await authorizedFetch(`/bookings/slots?${searchParams.toString()}`, { method: 'GET' });
      
      // We no longer filter out BOOKED slots because we want to show waitlist buttons
      setSlots(slotsData);
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, [providerId, authorizedFetch]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const groupedSlots = useMemo(() => {
    const groups = {};
    slots.forEach(slot => {
      const dateStr = new Date(slot.start_time).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const dateKey = new Date(slot.start_time).setHours(0,0,0,0);
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateStr,
          timestamp: dateKey,
          slots: []
        };
      }
      groups[dateKey].slots.push(slot);
    });
    
    const sortedGroups = Object.values(groups).sort((a, b) => a.timestamp - b.timestamp);
    sortedGroups.forEach(g => {
      g.slots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    
    return sortedGroups;
  }, [slots]);

  useEffect(() => {
    if (groupedSlots.length > 0 && !selectedDateStr) {
      setSelectedDateStr(groupedSlots[0].dateStr);
    }
  }, [groupedSlots, selectedDateStr]);

  const handleSelectSlot = (slot, isWaitlist) => {
    setModalSlot(slot);
    setIsWaitlistModal(isWaitlist);
  };

  const handleConfirmAction = async () => {
    if (!modalSlot) return;
    setBookingBusy(true);
    
    const idempotencyKey = crypto.randomUUID();

    try {
      if (isWaitlistModal) {
        const data = await authorizedFetch('/waitlist/join', {
          method: 'POST',
          body: JSON.stringify({ slot_id: modalSlot.id }),
        });
        setToast({ type: 'success', message: data.message });
      } else {
        const data = await authorizedFetch('/bookings/', {
          method: 'POST',
          body: JSON.stringify({ slot_id: modalSlot.id, idempotency_key: idempotencyKey }),
        });
        setToast({ type: 'success', message: 'Booking confirmed!' });
      }
      
      setModalSlot(null);
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setBookingBusy(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#fafcff] text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-2 w-fit">
            &larr; Back to Dashboard
          </Link>
          
          {loading ? (
            <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-lg" />
          ) : provider ? (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{provider.name}</h1>
              <p className="mt-1 text-slate-500">{provider.description}</p>
            </div>
          ) : (
            <h1 className="text-xl text-rose-600">Provider not found</h1>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <div className="space-y-6">
            <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />)}
            </div>
          </div>
        ) : groupedSlots.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-slate-500 font-medium">No slots found for this provider.</p>
          </div>
        ) : (
          <div className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Select a Date</h2>
              <div className="flex overflow-x-auto pb-4 gap-3 snap-x scrollbar-hide">
                {groupedSlots.map(group => {
                  const dateParts = group.dateStr.split(' ');
                  return (
                    <button
                      key={group.dateStr}
                      onClick={() => setSelectedDateStr(group.dateStr)}
                      className={[
                        "flex-shrink-0 snap-start flex flex-col items-center justify-center w-24 h-28 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                        selectedDateStr === group.dateStr
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-slate-100"
                      ].join(' ')}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                        {dateParts[1]} {dateParts[2]}
                      </span>
                      <span className="text-3xl font-bold mt-1 uppercase">
                        {dateParts[0].replace(',', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDateStr && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Available Times</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {groupedSlots.find(g => g.dateStr === selectedDateStr)?.slots.map(slot => (
                    <SlotButton key={slot.id} slot={slot} onSelect={handleSelectSlot} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold text-slate-950 tracking-tight">
                {isWaitlistModal ? 'Join Waitlist' : 'Confirm Booking'}
              </h3>
              <p className="mt-1 text-slate-500">
                {isWaitlistModal 
                  ? 'This slot is currently booked. Join the waitlist to be automatically promoted if it becomes available.'
                  : 'Please review your appointment details below.'}
              </p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100 mb-8">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-sm text-slate-500">Provider</span>
                <span className="font-medium text-slate-900">{provider?.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-sm text-slate-500">Date</span>
                <span className="font-medium text-slate-900">
                  {new Date(modalSlot.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Time</span>
                <span className="font-medium text-slate-900">
                  {new Date(modalSlot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalSlot(null)}
                disabled={bookingBusy}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={bookingBusy}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md focus:outline-none transition disabled:opacity-50"
              >
                {bookingBusy 
                  ? (isWaitlistModal ? 'Joining...' : 'Confirming...') 
                  : (isWaitlistModal ? 'Confirm Waitlist' : 'Confirm Booking')}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button type="button" onClick={() => setToast({ type: '', message: '' })} className="text-sm font-semibold opacity-80 hover:opacity-100">
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
