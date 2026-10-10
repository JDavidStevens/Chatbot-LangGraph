import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ChatService } from './services/chat';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const NEAR_BOTTOM_PX = 80;

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly chat = inject(ChatService);
  private readonly threadId = crypto.randomUUID();
  private readonly messages$ = new Subject<string>();
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  // Updated on scroll events, so it reflects the position before new content grew the list.
  private stickToBottom = true;

  protected message = '';
  protected readonly messages = signal<ChatMessage[]>([]);

  constructor() {
    this.messages$
      .pipe(
        // switchMap cancels the previous stream; catchError keeps the pipeline alive after a failure.
        switchMap((message) =>
          this.chat.streamChat(message, this.threadId).pipe(
            catchError((err) => {
              console.error(err);
              this.appendToLast('Something went wrong. Please try again.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((chunk) => this.appendToLast(chunk));

    afterRenderEffect({
      earlyRead: () => {
        this.messages();
        const el = this.scroller()?.nativeElement;
        return el && this.stickToBottom ? { el, top: el.scrollHeight } : undefined;
      },
      write: (target) => {
        const t = target();
        t?.el.scrollTo({ top: t.top });
      },
    });
  }

  protected onScroll(el: HTMLElement) {
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  submit() {
    const message = this.message.trim();
    if (!message) {
      return;
    }

    this.message = '';
    this.stickToBottom = true;
    this.messages.update((m) => [
      ...m,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ]);
    this.messages$.next(message);
  }

  private appendToLast(text: string) {
    this.messages.update((m) =>
      m.map((msg, i) => (i === m.length - 1 ? { ...msg, content: msg.content + text } : msg)),
    );
  }
}
