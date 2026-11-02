import { useEffect, useState } from 'react';
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import './toasts.css';

const FLASH = 'motodoc-flash';
const EVENT = 'motodoc-toast';
let nextToastId = 0;

export function toast(message, kind = 'success', action = null) {
  if (message) window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind, action } }));
}

export function flash(message, kind = 'success') {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ message, kind }));
  } catch {}
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const timers = new Set();
    const remove = (id) => setItems((list) => list.filter((item) => item.id !== id));
    const add = ({ message, kind, action }) => {
      const id = ++nextToastId;
      setItems((list) => [
        ...list.filter((item) => item.message !== message).slice(-2),
        { id, message, kind, action },
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
          {item.action?.href && (
            <a className="toast-action" href={item.action.href}>
              {item.action.label || 'Open'}
            </a>
          )}
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
