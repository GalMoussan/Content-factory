import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResponse } from 'node-mocks-http';
import { PipelineEventEmitter } from '../event-emitter';

// T019 — Server-Sent Events System
// Tests will fail at import until event-emitter.ts is implemented.

function makeMockResponse() {
  const res = createResponse({ eventEmitter: require('events').EventEmitter });
  res.setHeader = vi.fn();
  res.write = vi.fn();
  res.flushHeaders = vi.fn?.() ? vi.fn() : () => {};
  return res;
}

describe('T019 — Server-Sent Events System', () => {
  let emitter: PipelineEventEmitter;

  beforeEach(() => {
    emitter = new PipelineEventEmitter();
  });

  // Acceptance: "SSE endpoint sets correct headers"
  it('should set the required SSE headers when a client connects', () => {
    const res = makeMockResponse();
    emitter.addClient(res as never);

    const setCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const headers = Object.fromEntries(setCalls.map(([k, v]: [string, string]) => [k, v]));

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
  });

  // Acceptance: "Events broadcast to all connected clients"
  it('should write the event to all registered clients on broadcast', () => {
    const res1 = makeMockResponse();
    const res2 = makeMockResponse();

    emitter.addClient(res1 as never);
    emitter.addClient(res2 as never);

    emitter.broadcast({ type: 'pipeline:started', data: { runId: 'r001' } });

    expect(res1.write).toHaveBeenCalledOnce();
    expect(res2.write).toHaveBeenCalledOnce();
  });

  // Acceptance: "Event format: event: {type}\ndata: {json}\n\n"
  it('should format events according to the SSE specification', () => {
    const res = makeMockResponse();
    emitter.addClient(res as never);

    const event = { type: 'agent:completed', data: { agentName: 'TrendScout', runId: 'r002' } };
    emitter.broadcast(event);

    const written: string = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain('event: agent:completed');
    expect(written).toContain('data: ');
    expect(written).toMatch(/\n\n$/);

    const dataLine = written
      .split('\n')
      .find((l) => l.startsWith('data: '))!
      .slice('data: '.length);
    const parsed = JSON.parse(dataLine);
    expect(parsed.agentName).toBe('TrendScout');
  });

  // Acceptance: "Client disconnect properly cleaned up (no memory leak)"
  it('should remove a client after disconnect and stop sending to it', () => {
    const res = makeMockResponse();
    emitter.addClient(res as never);

    emitter.removeClient(res as never);
    emitter.broadcast({ type: 'pipeline:completed', data: { runId: 'r003' } });

    expect(res.write).not.toHaveBeenCalled();
  });

  // Acceptance: "Events validated against SSEEventSchema"
  it('should throw or discard an event missing a required type field', () => {
    expect(() => {
      // @ts-expect-error intentionally passing invalid event
      emitter.broadcast({ data: { foo: 'bar' } });
    }).toThrow();
  });

  // Acceptance: "Initial connection sends current pipeline status"
  it('should emit a connected event with current status immediately on client add', () => {
    const res = makeMockResponse();
    emitter.addClient(res as never);

    const written: string = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain('event: connected');
  });

  // Acceptance: "Broadcast does not throw when there are no clients"
  it('should not throw when broadcasting with zero connected clients', () => {
    expect(() => {
      emitter.broadcast({ type: 'pipeline:started', data: { runId: 'r004' } });
    }).not.toThrow();
  });
});
