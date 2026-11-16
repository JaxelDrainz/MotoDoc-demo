import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import { api } from './api.js';
import './assistant.css';

const START = {
  driver: [
    'What does my car need?',
    'When is my inspection?',
    'Check engine light is on',
    'When should I change to winter tyres?',
  ],
  garage: ['Booking requests', 'Overdue invoices', 'How do I close a day?', 'Add a mechanic'],
};
const KEY = 'motodoc-assistant';

export function AssistantPanel({ role, navigate, book }) {
  const [chat, setChat] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(chat.slice(-30)));
    } catch {}
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [chat]);

  const ask = async (message) => {
    const q = message.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    setChat((c) => [...c, { from: 'you', text: q }]);
    try {
      const r = await api('/assistant', {
        method: 'POST',
        body: { message: q, lang: document.documentElement.lang === 'fi' ? 'fi' : 'en' },
      });
      setChat((c) => [...c, { from: 'motodoc', ...r }]);
    } catch (e) {
      setChat((c) => [...c, { from: 'motodoc', text: e.message, actions: [], suggestions: [] }]);
    } finally {
      setBusy(false);
    }
  };
  const go = (href) => (href === 'book' ? book() : navigate(href.replace('#', '')));
  const kind = role === 'garage' ? 'garage' : 'driver';

  return (
    <section className="as-panel dash-tile" aria-label="Ask MotoDoc">
      <div className="as-log" aria-live="polite">
        <div className="as-msg motodoc">
          <p>
            {kind === 'garage'
              ? 'Hi! Ask me about bookings, invoices, your team or opening hours.'
              : 'Hi! Ask me about your car, warning lights, tyres, bookings or invoices.'}
          </p>
          {!chat.length && (
            <div className="as-chips">
              {START[kind].map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {chat.map((m, i) => (
          <div key={i} className={`as-msg ${m.from}`}>
            {String(m.text)
              .split('\n')
              .map((line, n) => (
                <p key={n}>{line}</p>
              ))}
            {m.actions?.length > 0 && (
              <div className="as-actions">
                {m.actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className="dash-secondary"
                    onClick={() => go(a.href)}
                  >
                    {a.label} <ArrowRightIcon size={14} />
                  </button>
                ))}
              </div>
            )}
            {m.suggestions?.length > 0 && (
              <div className="as-chips">
                {m.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="as-msg motodoc as-typing" aria-label="MotoDoc is answering">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="as-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question"
          aria-label="Your question"
        />
        <button className="button button-small" disabled={busy || !text.trim()} aria-label="Send">
          <PaperPlaneRightIcon size={18} />
        </button>
      </form>
      <p className="dash-help as-note">
        Answers come from MotoDoc’s built-in car-care guide and your account, not from a mechanic.
        If something feels unsafe, stop and call your garage.
        {chat.length > 0 && (
          <>
            {' '}
            <button type="button" className="dash-text-button" onClick={() => setChat([])}>
              Clear chat
            </button>
          </>
        )}
      </p>
    </section>
  );
}
