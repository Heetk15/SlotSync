import { useState, useEffect, useRef } from 'react';

export function useSlotSocket(slotId, apiUrl = process.env.NEXT_PUBLIC_API_URL, wsUrl = process.env.NEXT_PUBLIC_WS_URL) {  const [slotState, setSlotState] = useState({ status: 'AWAITING CONNECTION...', message: 'Initializing connection...' });
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [waitlistCount, setWaitlistCount] = useState(0);
  
  const ws = useRef(null);

  useEffect(() => {
    if (!slotId) return;

    const socket = new WebSocket(`${wsUrl}/bookings/ws/${slotId}`);
    ws.current = socket;

    socket.onopen = () => {
      setWsStatus('CONNECTED');
    };

    socket.onmessage = (event) => {
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

    socket.onclose = () => {
      setWsStatus('DISCONNECTED');
    };

    socket.onerror = () => {
      setWsStatus('ERROR');
    };

    return () => {
      socket.close();
    };
  }, [slotId, wsUrl]);

  return { slotState, wsStatus, waitlistCount };
}