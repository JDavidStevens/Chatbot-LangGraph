import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { ChatService } from './services/chat';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hi, what can I help you with?');
  });

  describe('submit', () => {
    it('should append streamed chunks to the reply', () => {
      const chunks = new Subject<string>();
      const streamChat = vi.fn().mockReturnValue(chunks);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance as any;
      app.message = 'hello';

      app.submit();
      chunks.next('hi ');
      chunks.next('there');

      expect(streamChat).toHaveBeenCalledWith('hello', expect.any(String));
      expect(app.reply()).toBe('hi there');
      expect(app.message).toBe('');
    });

    it('should unsubscribe from the previous stream on a new submit', () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.submit();
      app.submit();

      expect(first.observed).toBe(false);
      expect(second.observed).toBe(true);
    });

    it('should clear the previous reply on a new submit', () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.submit();
      first.next('old');
      app.submit();

      expect(app.reply()).toBe('');
      second.next('new');
      expect(app.reply()).toBe('new');
    });

    it('should keep working after a stream errors', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.submit();
      first.error(new Error('boom'));
      app.submit();
      second.next('recovered');

      expect(app.reply()).toBe('recovered');
    });

    it('should cancel the stream when the component is destroyed', () => {
      const chunks = new Subject<string>();
      const streamChat = vi.fn().mockReturnValue(chunks);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const fixture = TestBed.createComponent(App);
      (fixture.componentInstance as any).submit();
      expect(chunks.observed).toBe(true);

      fixture.destroy();

      expect(chunks.observed).toBe(false);
    });
  });
});
