import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChatService } from './chat';

describe('Chat', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should POST and emit each streamed chunk, then complete', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('hi '));
        controller.enqueue(encoder.encode('there'));
        controller.close();
      },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));

    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) =>
      service.streamChat('hello', 't1').subscribe({
        next: (c) => chunks.push(c),
        error: reject,
        complete: resolve,
      }),
    );

    const [url, init] = fetchSpy.mock.lastCall as [string, RequestInit];
    expect(url).toBe('/api/chat/stream');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hello', thread_id: 't1' });
    expect(chunks.join('')).toBe('hi there');
  });

  it('should error on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      new Promise<void>((resolve, reject) =>
        service.streamChat('hello', 't1').subscribe({ error: reject, complete: resolve }),
      ),
    ).rejects.toThrow('Request failed: 500');
  });

  it('should abort the request on unsubscribe', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(() => {}));

    const sub = service.streamChat('hello', 't1').subscribe();
    const init = fetchSpy.mock.lastCall![1] as RequestInit;
    sub.unsubscribe();

    expect(init.signal?.aborted).toBe(true);
  });
});
