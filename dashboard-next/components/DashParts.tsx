'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bell as BellIcon,
  Check,
  CircleCheck,
  Clock3,
  MessageSquare,
  Moon,
  Sun,
  TriangleAlert,
  X,
} from 'lucide-react';
import { api } from '../lib/api';

export type StatusKind = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'overdue';

const kindIcon = {
  pending: Clock3,
  confirmed: Check,
  completed: CircleCheck,
  cancelled: X,
  overdue: TriangleAlert,
};
const kindOf: Record<string, StatusKind> = {
  pending: 'pending',
  requested: 'pending',
  rescheduled: 'pending',
  reminder: 'pending',
  confirmed: 'confirmed',
  message: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  overdue: 'overdue',
};

export function StatusBadge({ kind, children }: { kind: StatusKind; children: string }) {
  const Icon = kindIcon[kind];
  return (
    <span
      className={`md-status md-kind-${kind} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-4`}
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}

const iconButton =
  'md-icon-button relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#111827] hover:bg-[#eaf6f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087658]';

export function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  useEffect(() => setTheme(document.documentElement.dataset.theme || 'light'), []);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className={iconButton}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          window.localStorage.setItem('motodoc-theme', next);
        } catch {}
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  at: string;
  due_date?: string;
}
interface Feed {
  items: Notice[];
  unread: number;
  seen_at: string;
}

const when = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

export function Bell({ onSelect }: { onSelect: () => void }) {
  const [feed, setFeed] = useState<Feed>({ items: [], unread: 0, seen_at: '' });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const load = () =>
      api<Feed>('/notifications')
        .then(setFeed)
        .catch(() => {});
    load();
    const timer = window.setInterval(() => !document.hidden && load(), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        (event instanceof KeyboardEvent && event.key === 'Escape') ||
        (event.type === 'pointerdown' && !box.current?.contains(event.target as Node))
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
    <div className="relative" ref={box}>
      <button
        className={iconButton}
        aria-label={feed.unread ? `Notifications, ${feed.unread} new` : 'Notifications'}
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon size={19} />
        {feed.unread > 0 && (
          <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-[#b3261e] px-1 text-[10px] font-semibold leading-4 text-white">
            {Math.min(feed.unread, 9)}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="md-panel absolute right-0 top-[calc(100%+8px)] z-40 max-h-[min(460px,70vh)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[#d7dce0] bg-white p-2 pt-4 text-left shadow-xl max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-16 max-sm:w-auto"
        >
          <h2 className="mx-2.5 mb-2 text-[17px] font-semibold tracking-tight">Notifications</h2>
          {feed.items.length ? (
            <ul>
              {feed.items.map((item) => {
                const kind = kindOf[item.type] ?? 'confirmed';
                const Icon = item.type === 'message' ? MessageSquare : kindIcon[kind];
                return (
                  <li key={item.id}>
                    <button
                      className="flex w-full gap-3 rounded-xl p-2.5 text-left hover:bg-[#eaf6f0]"
                      onClick={() => {
                        setOpen(false);
                        onSelect();
                      }}
                    >
                      <span
                        className={`md-kind-${kind} flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}
                      >
                        <Icon size={15} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span className="grid min-w-0 gap-0.5 text-[13px] leading-5 text-[#626a72]">
                        <strong className="text-sm font-medium text-[#111827]">
                          {item.title}
                          {item.at > feed.seen_at && (
                            <span className="ml-2 inline-block h-[7px] w-[7px] rounded-full bg-[#b3261e]" />
                          )}
                        </strong>
                        <span className="break-words">{item.body}</span>
                        <small className="text-xs">
                          {item.due_date ? `Due ${item.due_date}` : when(item.at)}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mx-2.5 mb-2.5 text-sm leading-6 text-[#626a72]">
              Nothing new. Messages, booking updates and due reminders will appear here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export function SlotPicker({
  garageId,
  value,
  onChange,
}: {
  garageId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [days] = useState(() =>
    Array.from({ length: 14 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + index);
      return day;
    }),
  );
  const [day, setDay] = useState(days[1]);
  const [busy, setBusy] = useState<Set<string> | null>(null);
  useEffect(() => {
    const to = new Date(days[13]);
    to.setDate(to.getDate() + 1);
    api<string[]>(`/garages/${garageId}/busy?from=${days[0].toISOString()}&to=${to.toISOString()}`)
      .then((taken) => setBusy(new Set(taken)))
      .catch(() => setBusy(new Set()));
  }, [garageId, days]);
  const [now] = useState(() => Date.now());
  const pill =
    'md-slot border border-[#d7dce0] bg-white text-[#111827] hover:border-[#087658] aria-pressed:border-[#087658] aria-pressed:bg-[#087658] aria-pressed:text-white disabled:cursor-not-allowed disabled:bg-[#f1f4f3] disabled:text-[#a3aba7] disabled:line-through';
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {days.map((item) => (
          <button
            type="button"
            key={item.getTime()}
            aria-pressed={item.getTime() === day.getTime()}
            onClick={() => setDay(item)}
            className={`${pill} grid w-[54px] shrink-0 gap-px rounded-xl py-1.5 text-center`}
          >
            <small className="text-[11px] opacity-70">
              {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(item)}
            </small>
            <strong className="text-[17px] font-semibold">{item.getDate()}</strong>
            <small className="text-[11px] opacity-70">
              {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(item)}
            </small>
          </button>
        ))}
      </div>
      <div
        aria-busy={!busy}
        className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5"
      >
        {HOURS.map((hour) => {
          const start = new Date(day);
          start.setHours(hour);
          const iso = start.toISOString();
          return (
            <button
              type="button"
              key={hour}
              disabled={!busy || busy.has(iso) || start.getTime() <= now}
              aria-pressed={value === iso}
              onClick={() => onChange(iso)}
              className={`${pill} min-h-10 rounded-full text-sm tabular-nums`}
            >
              {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
                start,
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[13px] text-[#626a72]">
        {value
          ? `Selected: ${when(value)}`
          : busy
            ? 'Greyed-out times are already booked or in the past.'
            : 'Checking free times…'}
      </p>
    </div>
  );
}

export function MileageTrend({ points }: { points: { date: string; km: number }[] }) {
  if (points.length < 2) return null;
  const times = points.map((point) => new Date(point.date).getTime());
  const start = times[0],
    span = Math.max(1, times[times.length - 1] - start);
  const low = points[0].km,
    range = Math.max(1, points[points.length - 1].km - low);
  const at = (index: number) =>
    [
      8 + ((times[index] - start) / span) * 284,
      46 - ((points[index].km - low) / range) * 36,
    ] as const;
  const line = points.map((_, index) => at(index).join(',')).join(' ');
  const format = new Intl.NumberFormat('en-GB');
  return (
    <figure className="mb-5 rounded-xl border border-[#d7dce0] p-4">
      <figcaption className="flex items-baseline justify-between gap-3 text-sm text-[#626a72]">
        <span>Mileage trend</span>
        <span className="tabular-nums">
          {format.format(points[0].km)} → {format.format(points[points.length - 1].km)} km
        </span>
      </figcaption>
      <svg
        viewBox="0 0 300 56"
        role="img"
        aria-label={`Mileage rose from ${format.format(points[0].km)} to ${format.format(points[points.length - 1].km)} km`}
        className="mt-2 h-14 w-full"
        preserveAspectRatio="none"
      >
        <polyline points={`8,54 ${line} 292,54`} fill="#0b7b5b" opacity="0.1" />
        <polyline
          points={line}
          fill="none"
          stroke="#0b7b5b"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((_, index) => (
          <circle key={index} cx={at(index)[0]} cy={at(index)[1]} r="2.5" fill="#0b7b5b" />
        ))}
      </svg>
    </figure>
  );
}
