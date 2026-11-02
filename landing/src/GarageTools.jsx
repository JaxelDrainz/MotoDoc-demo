import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarXIcon, ClockIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import { SPECIALIZATIONS, WEEKDAYS, hoursProblem } from './finland.js';
import './garage-tools.css';

const euros = (cents) =>
  `€${(cents / 100).toLocaleString('fi-FI', { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;
export const priceText = (s) =>
  s.price_min_cents != null && s.price_max_cents != null
    ? s.price_min_cents === s.price_max_cents
      ? euros(s.price_min_cents)
      : `${euros(s.price_min_cents)}–${euros(s.price_max_cents).slice(1)}`
    : s.price_min_cents != null
      ? `from ${euros(s.price_min_cents)}`
      : s.price_max_cents != null
        ? `up to ${euros(s.price_max_cents)}`
        : 'Estimate on inspection';
export const durationText = (s) => (s.minutes ? `~${s.minutes} min` : 'Varies');
export const specLabel = (key) => SPECIALIZATIONS.find(([k]) => k === key)?.[1] || key;
const dayName = (key) => WEEKDAYS.find(([k]) => k === key)[1];
const todayKey = () => WEEKDAYS[(new Date().getDay() + 6) % 7][0];

function Modal({ title, note, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dash-dialog gt-dialog"
      aria-labelledby="gt-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="Close"
        onClick={onClose}
      >
        <XIcon size={21} />
      </button>
      <h2 id="gt-title">{title}</h2>
      {note && <p className="dash-help">{note}</p>}
      {children}
      <div className="dash-form-actions">{footer}</div>
    </dialog>
  );
}

function HoursEditor({ initial, onClose, onSaved }) {
  const [hours, setHours] = useState(initial);
  const [busy, setBusy] = useState(false);
  const problem = hoursProblem(hours);
  const setDay = (key, patch) => setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  const save = async () => {
    setBusy(true);
    try {
      await api('/garage/hours', { method: 'PUT', body: { hours } });
      toast('Opening hours updated');
      await onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Business hours"
      note="Drivers can only book times inside these hours. Switch a day off to close it."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="dash-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-small"
            disabled={!!problem || busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save hours'}
          </button>
        </>
      }
    >
      <button
        type="button"
        className="ob-link"
        onClick={() =>
          setHours((h) =>
            Object.fromEntries(
              WEEKDAYS.map(([key]) => [key, ['sat', 'sun'].includes(key) ? h[key] : { ...h.mon }]),
            ),
          )
        }
      >
        Copy Monday to all weekdays
      </button>
      <ul className="ob-hours">
        {WEEKDAYS.map(([key, label]) => {
          const day = hours[key];
          const bad = day.open && !(day.to > day.from);
          return (
            <li key={key} className={day.open ? '' : 'closed'}>
              <label className="ob-day">
                <input
                  type="checkbox"
                  role="switch"
                  checked={day.open}
                  onChange={(e) => setDay(key, { open: e.target.checked })}
                />
                <span>{label}</span>
              </label>
              {day.open ? (
                <span className="ob-times">
                  <input
                    type="time"
                    aria-label={`${label} opens`}
                    value={day.from}
                    aria-invalid={bad}
                    onChange={(e) => setDay(key, { from: e.target.value })}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    aria-label={`${label} closes`}
                    value={day.to}
                    aria-invalid={bad}
                    onChange={(e) => setDay(key, { to: e.target.value })}
                  />
                </span>
              ) : (
                <span className="ob-closed">No bookings this day</span>
              )}
            </li>
          );
        })}
      </ul>
      {problem && <p className="ob-error">{problem}</p>}
    </Modal>
  );
}

function BlockedDays({ blocked, onClose, onSaved }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const block = async () => {
    if (!date) return toast('Pick a date to block', 'error');
    try {
      await api('/garage/blocked', { method: 'POST', body: { date, reason } });
      toast('Date blocked — drivers can’t book it');
      setDate('');
      setReason('');
      await onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const unblock = async (d) => {
    try {
      await api(`/garage/blocked/${d}`, { method: 'DELETE', body: {} });
      toast('Day reopened for bookings');
      await onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal
      title="Blocked days"
      note="Close single days, for example holidays or training. Drivers can’t book them."
      onClose={onClose}
      footer={
        <button type="button" className="button button-small" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="gt-block-form">
        <label className="dash-field">
          Date
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="dash-field">
          Reason (optional)
          <input
            maxLength={120}
            value={reason}
            placeholder="Closed"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button type="button" className="dash-secondary" onClick={block}>
          Block
        </button>
      </div>
      {blocked.length ? (
        <ul className="gt-blocked">
          {blocked.map((b) => (
            <li key={b.date}>
              <span>
                <strong>
                  {new Date(`${b.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </strong>
                {b.reason && ` · ${b.reason}`}
              </span>
              <button type="button" className="dash-text-button" onClick={() => unblock(b.date)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-help">No blocked days.</p>
      )}
    </Modal>
  );
}

export function AvailabilityCard({ canEdit }) {
  const [state, setState] = useState(null);
  const [dialog, setDialog] = useState('');
  const load = useCallback(
    () =>
      api('/garage/schedule')
        .then(setState)
        .catch(() => setState(false)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!state) return null;
  const today = state.hours[todayKey()];
  const setOnline = async (online) => {
    try {
      await api('/garage/online', { method: 'PUT', body: { online } });
      toast(online ? 'You’re online — drivers can book you' : 'You’re offline — bookings paused');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <article className="dash-tile gt-availability">
      <label className="gt-online">
        <input
          type="checkbox"
          role="switch"
          checked={state.online}
          onChange={(e) => setOnline(e.target.checked)}
        />
        <span>
          <strong>{state.online ? 'You’re online' : 'You’re offline'}</strong>
          <small>
            {state.online
              ? 'Drivers can find and book you.'
              : 'Hidden from booking. New requests are paused.'}
          </small>
        </span>
      </label>
      <span className={`gt-pill ${state.open_now && state.online ? 'open' : ''}`}>
        {state.open_now && state.online ? 'Open now' : 'Closed now'}
      </span>
      <span className="gt-today">
        <ClockIcon size={16} aria-hidden="true" />
        {today?.open ? `Today: ${today.from}–${today.to}` : 'Today: Closed'}
      </span>
      <div className="gt-actions">
        {canEdit && (
          <button type="button" className="dash-secondary" onClick={() => setDialog('hours')}>
            <ClockIcon size={16} /> Business hours
          </button>
        )}
        <button type="button" className="dash-secondary" onClick={() => setDialog('blocked')}>
          <CalendarXIcon size={16} /> {`Blocked days (${state.blocked.length})`}
        </button>
      </div>
      {dialog === 'hours' && (
        <HoursEditor initial={state.hours} onClose={() => setDialog('')} onSaved={load} />
      )}
      {dialog === 'blocked' && (
        <BlockedDays blocked={state.blocked} onClose={() => setDialog('')} onSaved={load} />
      )}
    </article>
  );
}

export function ServicesPanel({ open, canEdit }) {
  const [items, setItems] = useState(null);
  const load = useCallback(
    () =>
      api('/garage/services')
        .then(setItems)
        .catch(() => setItems([])),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const edit = (s) =>
    open({
      title: s ? 'Edit service' : 'Add a service',
      note: 'Prices include VAT. Leave prices empty to show “Estimate on inspection”.',
      values: s
        ? {
            name: s.name,
            price_min: s.price_min_cents != null ? s.price_min_cents / 100 : '',
            price_max: s.price_max_cents != null ? s.price_max_cents / 100 : '',
            minutes: s.minutes ?? '',
            description: s.description,
          }
        : {},
      fields: [
        { name: 'name', label: 'Service name', required: true, maxLength: 80 },
        { name: 'price_min', label: 'Lowest price (€)', type: 'number', min: 0, step: 1 },
        { name: 'price_max', label: 'Highest price (€)', type: 'number', min: 0, step: 1 },
        { name: 'minutes', label: 'Takes about (minutes)', type: 'number', min: 5, step: 5 },
        { name: 'description', label: 'Short description', maxLength: 300 },
      ],
      submit: s ? 'Save changes' : 'Add service',
      save: async (d) => {
        const num = (v) => (v === '' || v == null ? null : Number(v));
        const body = {
          name: d.name,
          price_min: num(d.price_min),
          price_max: num(d.price_max),
          minutes: num(d.minutes),
          description: d.description,
          active: s ? s.active : true,
        };
        await api(s ? `/garage/services/${s.id}` : '/garage/services', {
          method: s ? 'PUT' : 'POST',
          body,
        });
        toast(s ? 'Service updated' : 'Service added');
        await load();
      },
    });
  const toggle = async (s) => {
    try {
      await api(`/garage/services/${s.id}`, {
        method: 'PUT',
        body: {
          name: s.name,
          price_min: s.price_min_cents != null ? s.price_min_cents / 100 : null,
          price_max: s.price_max_cents != null ? s.price_max_cents / 100 : null,
          minutes: s.minutes,
          description: s.description,
          active: !s.active,
        },
      });
      toast(s.active ? 'Service hidden' : 'Service bookable again');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = (s) =>
    open({
      title: 'Delete this service?',
      note: `Drivers will no longer be able to book ${s.name}.`,
      submit: 'Delete service',
      save: async () => {
        await api(`/garage/services/${s.id}`, { method: 'DELETE', body: {} });
        toast('Service removed');
        await load();
      },
    });
  return (
    <>
      <div className="dash-section-heading">
        <h2>My services</h2>
        {canEdit && (
          <button className="button button-small" onClick={() => edit(null)}>
            Add service <PlusIcon size={16} />
          </button>
        )}
      </div>
      <p className="dash-help">
        The services drivers can book from you. Prices are ranges — the final cost is confirmed
        after inspection.
      </p>
      {items === null ? (
        <p className="dash-help">Loading…</p>
      ) : (
        <div className="dash-list">
          {items.map((s) => (
            <article className="dash-row gt-service" key={s.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{s.name}</h3>
                  <span className={`dash-status kind-${s.active ? 'confirmed' : 'cancelled'}`}>
                    {s.active ? 'Bookable' : 'Hidden'}
                  </span>
                </div>
                {s.description && <p>{s.description}</p>}
                <p>
                  {priceText(s)} · {durationText(s)}
                </p>
              </div>
              {canEdit && (
                <div className="dash-row-actions">
                  <button className="dash-text-button" onClick={() => edit(s)}>
                    Edit
                  </button>
                  <button className="dash-text-button" onClick={() => toggle(s)}>
                    {s.active ? 'Hide' : 'Show'}
                  </button>
                  <button className="dash-text-button muted" onClick={() => remove(s)}>
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export const dayHours = (hours) => {
  const day = hours?.[todayKey()];
  return day?.open ? `${day.from}–${day.to}` : null;
};
export { dayName };

export function AnalyticsPanel({ data }) {
  const now = Date.now();
  const month = new Date().toISOString().slice(0, 7);
  const bookings = data.bookings || [];
  const invoices = data.invoices || [];
  const customers = data.customers || [];
  const completed = bookings.filter((b) => b.status === 'completed');
  const active = new Set(
    bookings
      .filter((b) => b.status !== 'cancelled' && now - Date.parse(b.starts_at) < 90 * 86400000)
      .map((b) => b.driver_id),
  );
  const paid = invoices.filter((i) => i.state === 'paid');
  const revenue = paid.reduce((sum, i) => sum + i.totals.total, 0);
  const members = (data.memberships || []).filter((m) => m.status === 'active');
  const memberRevenue = members.reduce((sum, m) => sum + Math.round((m.price_cents || 0) * 0.7), 0);
  const counts = {};
  for (const b of completed) counts[b.service] = (counts[b.service] || 0) + 1;
  const popular = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const top = popular[0]?.[1] || 1;
  const repeat = customers.filter((c) => Number(c.booking_count) > 1).length;
  const euro = (cents) =>
    new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const tiles = [
    ['Total customers', customers.length],
    ['Active customers (90 days)', active.size],
    ['Bookings this month', bookings.filter((b) => b.starts_at.startsWith(month)).length],
    ['Revenue received', euro(revenue)],
    ['Active members', members.length],
    ['Membership income / year', euro(memberRevenue)],
  ];
  return (
    <>
      <div className="dash-section-heading">
        <h2>Analytics</h2>
      </div>
      <div className="dash-stats gt-analytics-tiles">
        {tiles.map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="gt-analytics">
        <article className="dash-tile">
          <h3>Popular services</h3>
          {popular.length ? (
            <ul className="gt-bars">
              {popular.map(([service, count]) => (
                <li key={service}>
                  <span>{service}</span>
                  <span className="gt-bar" aria-hidden="true">
                    <span style={{ width: `${(count / top) * 100}%` }} />
                  </span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-help">Completed services appear here.</p>
          )}
        </article>
        <article className="dash-tile">
          <h3>Key metrics</h3>
          <dl className="gt-metrics">
            <div>
              <dt>Customer retention</dt>
              <dd>
                {customers.length ? `${Math.round((repeat / customers.length) * 100)}%` : '—'}
              </dd>
            </div>
            <div>
              <dt>Average customer lifetime value</dt>
              <dd>{customers.length ? euro(Math.round(revenue / customers.length)) : '—'}</dd>
            </div>
            <div>
              <dt>Average revenue per service</dt>
              <dd>{paid.length ? euro(Math.round(revenue / paid.length)) : '—'}</dd>
            </div>
            <div>
              <dt>Outstanding invoices</dt>
              <dd>
                {euro(
                  invoices
                    .filter((i) => ['unpaid', 'overdue'].includes(i.state))
                    .reduce((sum, i) => sum + i.totals.total, 0),
                )}
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </>
  );
}
