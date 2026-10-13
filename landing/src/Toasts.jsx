import { useEffect, useState } from 'react';
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import './toasts.css';

const FLASH = 'motodoc-flash';
const EVENT = 'motodoc-toast';

export function toast(message, kind = 'success') {
  if (message) window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

export function flash(message, kind = 'success') {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ message, kind }));
  } catch {}
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let next = 0;
    const timers = new Set();
    const remove = (id) => setItems((list) => list.filter((item) => item.id !== id));
    const add = ({ message, kind }) => {
      const id = ++next;
      setItems((list) => [
        ...list.filter((item) => item.message !== message).slice(-2),
        { id, message, kind },
      ]);
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          remove(id);
        },
        kind === 'error' ? 7000 : 4500,
      );
      timers.add(timer);
    };
    const onToast = (event) => add(event.detail);
    window.addEventListener(EVENT, onToast);
    try {
      const pending = sessionStorage.getItem(FLASH);
      if (pending) {
        sessionStorage.removeItem(FLASH);
        add(JSON.parse(pending));
      }
    } catch {}
    return () => {
      window.removeEventListener(EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast toast-${item.kind}`}
          role={item.kind === 'error' ? 'alert' : 'status'}
        >
          {item.kind === 'error' ? (
            <WarningCircleIcon size={21} weight="fill" aria-hidden="true" />
          ) : (
            <CheckCircleIcon size={21} weight="fill" aria-hidden="true" />
          )}
          <span>{item.message}</span>
          <button
            aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((other) => other.id !== item.id))}
          >
            <XIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
