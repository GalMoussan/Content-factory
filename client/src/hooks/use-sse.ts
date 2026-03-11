import { useEffect, useRef, useState } from 'react';

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

interface UseSSEResult {
  lastEvent: SSEEvent | null;
  connected: boolean;
}

export function useSSE(url: string = '/api/events'): UseSSEResult {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent({ type: event.type, data });
      } catch {
        // ignore parse errors
      }
    };

    // Listen for known event types
    const eventTypes = [
      'connected',
      'pipeline:started',
      'pipeline:completed',
      'pipeline:failed',
      'agent:started',
      'agent:completed',
    ];
    for (const type of eventTypes) {
      source.addEventListener(type, (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          setLastEvent({ type, data });
        } catch {
          // ignore
        }
      });
    }

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [url]);

  return { lastEvent, connected };
}
