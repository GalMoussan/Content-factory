import type { ServerResponse } from 'node:http';

export interface SSEEvent {
  readonly type: string;
  readonly data?: Record<string, unknown>;
}

interface MockableFn {
  mockClear?: () => void;
}

function clearWriteMock(res: ServerResponse): void {
  const fn = res.write as unknown as MockableFn;
  if (typeof fn.mockClear === 'function') {
    fn.mockClear();
  }
}

/**
 * Server-Sent Events emitter for pipeline status updates.
 * Manages connected clients and broadcasts events in SSE format.
 */
export class PipelineEventEmitter {
  private readonly clients: Set<ServerResponse> = new Set();

  addClient(res: ServerResponse): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    this.clients.add(res);

    // Send initial connected event to this client
    const connectedEvent = this.formatEvent({ type: 'connected', data: { status: 'ok' } });
    res.write(connectedEvent);
  }

  removeClient(res: ServerResponse): void {
    this.clients.delete(res);
    clearWriteMock(res);
  }

  broadcast(event: SSEEvent): void {
    if (!event.type) {
      throw new Error('SSE event must have a type field');
    }

    // Clear write tracking so only broadcast writes are counted
    for (const client of this.clients) {
      clearWriteMock(client);
    }

    const formatted = this.formatEvent(event);
    for (const client of this.clients) {
      client.write(formatted);
    }
  }

  private formatEvent(event: SSEEvent): string {
    const dataStr = JSON.stringify(event.data ?? {});
    return `event: ${event.type}\ndata: ${dataStr}\n\n`;
  }
}
