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
  invited: 'pending',
  suspended: 'cancelled',
  verified: 'confirmed',
  rejected: 'cancelled',
  approved: 'confirmed',
  'awaiting approval': 'pending',
  'no quotes yet': 'overdue',
  booked: 'confirmed',
  open: 'pending',
  closed: 'cancelled',
  ends: 'pending',
  'renews soon': 'pending',
  ended: 'cancelled',
  refunded: 'cancelled',
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
    timeZone: 'Europe/Helsinki',
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
                        item.link ||
                        (item.type === 'reminder' || item.type === 'overdue'
                          ? '#reminders'
                          : '#bookings')
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

export function SlotPicker({ garageId, name }) {
  const [days, setDays] = useState(null),
    [day, setDay] = useState(null),
    [value, setValue] = useState(''),
    [availabilityError, setAvailabilityError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setDays(null);
    setAvailabilityError('');
    api(`/garages/${garageId}/availability?days=21`)
      .then((list) => {
        if (!active) return;
        setDays(list);
        setDay((current) => current || (list.find((d) => d.slots.length) || list[0])?.date);
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
  }, [garageId, attempt]);
  const selected = days?.find((d) => d.date === day);
  const label = (date, options) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
  return (
    <div className="dash-slots">
      <div className="dash-slot-days" aria-busy={!days && !availabilityError}>
        {(days || []).map((item) => (
          <button
            type="button"
            key={item.date}
            className={item.slots.length ? '' : 'closed'}
            aria-pressed={item.date === day}
            onClick={() => {
              setDay(item.date);
              setValue('');
            }}
          >
            <small>{label(item.date, { weekday: 'short' })}</small>
            <strong>{Number(item.date.slice(8))}</strong>
            <small>{label(item.date, { month: 'short' })}</small>
          </button>
        ))}
      </div>
      {selected && selected.slots.length > 0 && (
        <div className="dash-slot-times">
          {selected.slots.map((iso) => (
            <button
              type="button"
              key={iso}
              aria-pressed={value === iso}
              onClick={() => setValue(iso)}
            >
              {new Date(iso).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Helsinki',
              })}
            </button>
          ))}
        </div>
      )}
      {selected && !selected.slots.length && (
        <p className="dash-slot-reason">{selected.reason || 'No times left on this day.'}</p>
      )}
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
          : days
            ? 'Times are in Finnish time and follow the garage’s opening hours.'
            : 'Checking free times…'}
      </p>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
