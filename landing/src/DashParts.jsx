import { useEffect, useRef, useState } from 'react';
import {
  BellIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  MoonIcon,
  SunIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import './extras.css';

const kinds = {
  pending: ClockIcon,
  confirmed: CheckIcon,
  completed: CheckCircleIcon,
  cancelled: XIcon,
  overdue: WarningIcon,
};
const kindOf = {
  pending: 'pending',
  requested: 'pending',
  unpaid: 'pending',
  upcoming: 'pending',
  rescheduled: 'pending',
  reminder: 'pending',
  confirmed: 'confirmed',
  active: 'confirmed',
  listed: 'confirmed',
  completed: 'completed',
  paid: 'completed',
  done: 'completed',
  cancelled: 'cancelled',
  void: 'cancelled',
  draft: 'cancelled',
  overdue: 'overdue',
};

export function Status({ children }) {
  const kind = kindOf[children] || 'cancelled',
    Icon = kinds[kind];
  return (
    <span className={`dash-status kind-${kind}`}>
      <Icon size={13} weight="bold" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="icon-button md-theme-toggle"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('motodoc-theme', next);
        } catch {}
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
    </button>
  );
}

const when = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function Bell() {
  const [feed, setFeed] = useState({ items: [], unread: 0, seen_at: '' }),
    [open, setOpen] = useState(false),
    box = useRef(null);
  useEffect(() => {
    const load = () =>
      api('/notifications')
        .then(setFeed)
        .catch(() => {});
    load();
    const timer = setInterval(() => !document.hidden && load(), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (
        event.key === 'Escape' ||
        (event.type === 'pointerdown' && !box.current.contains(event.target))
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  function toggle() {
    setOpen(!open);
    if (!open && feed.unread) {
      api('/notifications/seen', { method: 'POST', body: {} }).catch(() => {});
      setFeed((current) => ({ ...current, unread: 0 }));
    }
  }
  return (
    <div className="dash-bell" ref={box}>
      <button
        className="icon-button"
        aria-label={feed.unread ? `Notifications, ${feed.unread} new` : 'Notifications'}
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon size={20} />
        {feed.unread > 0 && <span className="dash-bell-count">{Math.min(feed.unread, 9)}</span>}
      </button>
      {open && (
        <div className="dash-bell-panel" role="dialog" aria-label="Notifications">
          <h2>Notifications</h2>
          {feed.items.length ? (
            <ul>
              {feed.items.map((item) => {
                const kind = kindOf[item.type] || 'confirmed',
                  Icon = item.type === 'message' ? ChatCircleIcon : kinds[kind];
                return (
                  <li key={item.id} className={item.at > feed.seen_at ? 'new' : ''}>
                    <a
                      href={
                        item.type === 'reminder' || item.type === 'overdue'
                          ? '#reminders'
                          : '#bookings'
                      }
                      onClick={() => setOpen(false)}
                    >
                      <span
                        className={`dash-bell-icon kind-${item.type === 'message' ? 'confirmed' : kind}`}
                      >
                        <Icon size={16} weight="bold" />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                        <small>{item.due_date ? `Due ${item.due_date}` : when(item.at)}</small>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Nothing new. Messages, booking updates and due reminders will appear here.</p>
          )}
        </div>
      )}
    </div>
  );
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export function SlotPicker({ garageId, name }) {
  const [days] = useState(() =>
    Array.from({ length: 14 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + index);
      return day;
    }),
  );
  const [day, setDay] = useState(days[1]),
    [value, setValue] = useState(''),
    [busy, setBusy] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(null);
    setAvailabilityError('');
    const to = new Date(days[13]);
    to.setDate(to.getDate() + 1);
    api(`/garages/${garageId}/busy?from=${days[0].toISOString()}&to=${to.toISOString()}`)
      .then((taken) => {
        if (active) setBusy(new Set(taken));
      })
      .catch(() => {
        if (active) {
          setAvailabilityError('Available times could not be checked. Please retry.');
          setValue('');
        }
      });
    return () => {
      active = false;
    };
  }, [garageId, days, attempt]);
  const slot = (hour) => {
    const start = new Date(day);
    start.setHours(hour);
    return start;
  };
  const free = (start) => busy && !busy.has(start.toISOString()) && start.getTime() > Date.now();
  return (
    <div className="dash-slots">
      <div className="dash-slot-days">
        {days.map((item) => (
          <button
            type="button"
            key={item.getTime()}
            aria-pressed={item.getTime() === day.getTime()}
            onClick={() => {
              setDay(item);
              setValue('');
            }}
          >
            <small>{item.toLocaleDateString(undefined, { weekday: 'short' })}</small>
            <strong>{item.getDate()}</strong>
            <small>{item.toLocaleDateString(undefined, { month: 'short' })}</small>
          </button>
        ))}
      </div>
      <div className="dash-slot-times" aria-busy={!busy && !availabilityError}>
        {HOURS.map((hour) => {
          const start = slot(hour),
            iso = start.toISOString();
          return (
            <button
              type="button"
              key={hour}
              disabled={!free(start)}
              aria-pressed={value === iso}
              onClick={() => setValue(iso)}
            >
              {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </button>
          );
        })}
      </div>
      {availabilityError && (
        <div role="alert" className="dash-error">
          <p>{availabilityError}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="dash-secondary">
            Retry availability
          </button>
        </div>
      )}
      <p className="dash-slot-note">
        {value
          ? `Selected: ${when(value)}`
          : busy
            ? 'Greyed-out times are already booked or in the past.'
            : 'Checking free times…'}
      </p>
      <p className="dash-slot-note">
        Times use your device�s timezone. Your garage confirms the appointment.
      </p>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
