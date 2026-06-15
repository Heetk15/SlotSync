'use client';

import { useState } from 'react';
import { useSlotSocket } from '../hooks/useSlotSocket';

export default function SlotSyncDashboard() {
  const [slotId, setSlotId] = useState('');
  const [userId, setUserId] = useState('user_' + Math.floor(Math.random() * 1000));
  const [actionStatus, setActionStatus] = useState({ type: 'idle', message: '' });
  
  const { slotState, wsStatus, waitlistCount } = useSlotSocket(slotId);

  const triggerBooking = async () => {
    if (!slotId) {
      setActionStatus({ type: 'error', message: 'Target Slot UUID is required.' });
      return;
    }

    setActionStatus({ type: 'processing', message: 'Authenticating and acquiring distributed locks...' });
    
    try {
      // 1. Fetch the stateless JWT
      const authRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (!authRes.ok) throw new Error("Authentication gateway failed.");
      const { access_token } = await authRes.json();

      // 2. Dispatch the booking request with the Bearer token
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}` 
        },
        body: JSON.stringify({
          slot_id: slotId,
          idempotency_key: crypto.randomUUID()
        })
      });

      const data = await response.json();

      if (response.status === 429) {
        setActionStatus({ type: 'error', message: `❌ Rate Limit Triggered: ${data.detail}` });
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Transaction failed');
      }

      setActionStatus({ 
        type: 'success', 
        message: `Transaction verified: ${data.message} (${data.status})` 
      });

    } catch (err) {
      setActionStatus({ type: 'error', message: `System error: ${err.message}` });
    }
  };

  const triggerCancellation = async () => {
    if (!slotId) return;
    setActionStatus({ type: 'processing', message: 'Authenticating and propagating cancellation sequence...' });
    
    try {
      // 1. Fetch the stateless JWT
      const authRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (!authRes.ok) throw new Error("Authentication gateway failed.");
      const { access_token } = await authRes.json();

      // 2. Dispatch the cancellation request enforcing IDOR defense
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${slotId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${access_token}` 
        }
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail);
      
      setActionStatus({ type: 'success', message: `Slot freed. Waitlist promotion worker dispatched.` });
    } catch (err) {
      setActionStatus({ type: 'error', message: `Cancellation failed: ${err.message}` });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Block */}
        <header className="border-b border-slate-200 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SlotSync Engine Control Center</h1>
            <p className="text-sm text-slate-500">Real-time state verification dashboard</p>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <span className="text-slate-600">WS ENGINE: {wsStatus}</span>
          </div>
        </header>

        {/* Configuration Matrix */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target Environment Configuration</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-mono">TARGET_SLOT_UUID</label>
              <input 
                type="text" 
                value={slotId} 
                onChange={(e) => setSlotId(e.target.value.trim())}
                placeholder="Paste slot ID here..."
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded p-2 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-mono">CLIENT_USER_IDENTITY</label>
              <input 
                type="text" 
                value={userId} 
                onChange={(e) => setUserId(e.target.value.trim())}
                placeholder="User identifier..."
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded p-2 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Engine Real-Time State Display */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Live Engine Telemetry</h2>
              <div className="flex items-baseline space-x-2">
                <span className={`text-3xl font-bold tracking-tight font-mono ${
                  slotState.status === 'BOOKED' ? 'text-rose-600' : 
                  slotState.status === 'AVAILABLE' ? 'text-emerald-600' : 
                  slotState.status === 'WAITLISTED' ? 'text-amber-600' : 'text-slate-400'
                }`}>
                  {slotState.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">{slotState.message}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">In-Memory Redis Waitlist:</span>
              <span className="font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{waitlistCount || 0} users queued</span>
            </div>
          </div>
        </section>

        {/* Command Controls */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Transaction Orchestration</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={triggerBooking}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded shadow-sm transition-colors"
            >
              Dispatch Booking Request
            </button>
            <button
              onClick={triggerCancellation}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm px-4 py-2.5 rounded shadow-sm transition-colors"
            >
              Release Slot (Trigger Cascade)
            </button>
          </div>

          {/* Local Action Log Output */}
          {actionStatus.message && (
            <div className={`text-xs font-mono p-3 rounded border ${
              actionStatus.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              actionStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              {actionStatus.message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}