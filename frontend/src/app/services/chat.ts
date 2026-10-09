import { Injectable } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

@Injectable({ providedIn: 'root' })
export class ChatService {
  streamChat(message: string, threadId: string): Observable<string> {
    // fromFetch aborts the request on unsubscribe.
    return fromFetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, thread_id: threadId }),
    }).pipe(
      switchMap((res): Observable<string> => {
        if (!res.ok || !res.body) {
          throw new Error(`Request failed: ${res.status}`);
        }
        return from<AsyncIterable<string>>(res.body.pipeThrough(new TextDecoderStream()));
      }),
    );
  }
}
