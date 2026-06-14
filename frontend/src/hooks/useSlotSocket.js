import { useState, useEffect, useCallback, useRef } from 'react';

export function useSlotSocket(slotId, apiUrl = 'http://127.0.0.1:8000', wsUrl = 'ws://127.0.0.1:8000') {
  const [slotState, setSlotState] = useState({ status: 'AWAITING CONNECTION...', message: 'Initializing connection...' });
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [waitlistCount, setWaitlistCount] = useState(0);
  
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const connect = useCallback(() => {
    if (!slotId) return;

    setWsStatus('CONNECTING');
    ws.current = new WebSocket(`${wsUrl}/bookings/ws/${slotId}`);

    ws.current.onopen = () => {
      setWsStatus('CONNECTED');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Map backend event updates directly to React state
        setSlotState({
          status: data.status,
          message: data.message || 'State updated via live stream.'
        });
        
        // If our backend eventually broadcasts queue depth, we catch it here
        if (data.waitlist_count !== undefined) {
          setWaitlistCount(data.waitlist_count);
        }
      } catch (err) {
        console.error("Malformed event payload received:", err);
      }
    };

    ws.current.onclose = () => {
      setWsStatus('DISCONNECTED');
      // Fault tolerance: Auto-reconnect after 3 seconds if the connection drops
      reconnectTimeout.current = setTimeout(() => {
        console.log("Attempting socket reconnection...");
        connect();
      }, 3000);
    };

    ws.current.onerror = () => {
      setWsStatus('ERROR');
    };
  }, [slotId, wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { slotState, wsStatus, waitlistCount };
}