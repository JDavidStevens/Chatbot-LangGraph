import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ChatService } from './services/chat';

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

  protected message = '';
  protected readonly reply = signal('');

  constructor() {
    this.messages$
      .pipe(
        // switchMap cancels the previous stream; catchError keeps the pipeline alive after a failure.
        switchMap((message) =>
          this.chat.streamChat(message, this.threadId).pipe(
            catchError((err) => {
              console.error(err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((chunk) => this.reply.update((text) => text + chunk));
  }

  submit() {
    const message = this.message;
    this.message = '';
    this.reply.set('');
    this.messages$.next(message);
  }
}
