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
      expect(app.messages()).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ]);
      expect(app.message).toBe('');
    });

    it('should ignore blank messages', () => {
      const streamChat = vi.fn();
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.message = '   ';
      app.submit();

      expect(streamChat).not.toHaveBeenCalled();
      expect(app.messages()).toEqual([]);
    });

    it('should unsubscribe from the previous stream on a new submit', () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.message = 'one';
      app.submit();
      app.message = 'two';
      app.submit();

      expect(first.observed).toBe(false);
      expect(second.observed).toBe(true);
    });

    it('should keep earlier messages when a new one is submitted', () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.message = 'one';
      app.submit();
      first.next('old');
      app.message = 'two';
      app.submit();
      second.next('new');

      expect(app.messages().map((m: any) => m.content)).toEqual(['one', 'old', 'two', 'new']);
    });

    it('should keep working after a stream errors', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = new Subject<string>();
      const second = new Subject<string>();
      const streamChat = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const app = TestBed.createComponent(App).componentInstance as any;
      app.message = 'one';
      app.submit();
      first.error(new Error('boom'));
      expect(app.messages().at(-1).content).toContain('Something went wrong');

      app.message = 'two';
      app.submit();
      second.next('recovered');

      expect(app.messages().at(-1).content).toBe('recovered');
    });

    it('should cancel the stream when the component is destroyed', () => {
      const chunks = new Subject<string>();
      const streamChat = vi.fn().mockReturnValue(chunks);
      TestBed.overrideProvider(ChatService, { useValue: { streamChat } });

      const fixture = TestBed.createComponent(App);
      (fixture.componentInstance as any).message = 'hello';
      (fixture.componentInstance as any).submit();
      expect(chunks.observed).toBe(true);

      fixture.destroy();

      expect(chunks.observed).toBe(false);
    });
  });
});
