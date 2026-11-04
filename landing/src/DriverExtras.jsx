import { useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  ChatCircleIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Status } from './DashParts.jsx';
import { BASIC_BENEFITS, FULL_EXTRAS } from './membership.js';
import { WEEKDAYS } from './finland.js';
import './driver-extras.css';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const iso = (value) => (value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
const day = (value) =>
  new Date(value.length === 10 ? `${value}T12:00:00Z` : iso(value)).toLocaleDateString('en-FI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Helsinki',
  });
const clock = (value) =>
  new Date(iso(value)).toLocaleTimeString('en-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const FUEL = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  electric: 'Electric',
  gas: 'Gas',
};
const daysTo = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.now()) / 86400000);

export function CarDetail({ vehicle: v, history, onBack, onEdit, onRemove }) {
  const records = history.filter((r) => r.vehicle_id === v.id);
  const spent = records.reduce((s, r) => s + (r.cost_cents || 0), 0);
  const deadlines = [
    ['Inspection', v.mot_due],
    ['Insurance', v.insurance_due],
    ['Vehicle tax', v.tax_due],
  ];
  return (
    <>
      <button className="dash-text-button dx-back" onClick={onBack}>
        <ArrowLeftIcon size={16} /> All cars
      </button>
      <article className="dash-tile dx-car">
        <span className="dash-plate">{v.registration}</span>
        <h2>{`${v.make} ${v.model}`}</h2>
        <p>{[v.year, FUEL[v.fuel_type]].filter(Boolean).join(' · ')}</p>
        <div className="ex-buttons">
          <button className="button button-small" onClick={onEdit}>
            Edit details
          </button>
          <button className="dash-text-button muted" onClick={onRemove}>
            Remove car
          </button>
        </div>
      </article>
      <div className="dash-section-heading">
        <h2>Deadlines</h2>
      </div>
      <div className="dash-list">
        {deadlines.map(([label, due]) => {
          const n = due ? daysTo(due) : null;
          return (
            <article className="dash-row" key={label}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{label}</h3>
                  {due && <Status>{n < 0 ? 'overdue' : n <= 30 ? 'due soon' : 'on track'}</Status>}
                </div>
                <p>
                  {!due
                    ? 'Not set. Add the date under Edit details.'
                    : n < 0
                      ? `${day(due)} · ${-n} days late`
                      : `${day(due)} · in ${n} days`}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="dash-section-heading">
        <h2>Details</h2>
      </div>
      <dl className="mk-summary dash-tile">
        <dt>Mileage</dt>
        <dd>{`${v.mileage.toLocaleString('en-FI')} km`}</dd>
        <dt>Fuel</dt>
        <dd>{FUEL[v.fuel_type] || '—'}</dd>
        <dt>VIN</dt>
        <dd>{v.vin || '—'}</dd>
        {v.oil_life != null && (
          <>
            <dt>Oil life</dt>
            <dd>{`${v.oil_life}%`}</dd>
          </>
        )}
        {v.brake_wear != null && (
          <>
            <dt>Brake wear</dt>
            <dd>{`${v.brake_wear}%`}</dd>
          </>
        )}
      </dl>
      <div className="dash-section-heading">
        <h2>Service history</h2>
        <span className="mem-pill">{`${euro(spent)} total spent`}</span>
      </div>
      {records.length ? (
        <div className="dash-list">
          {records.map((r) => (
            <article className="dash-row" key={r.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{r.service}</h3>
                  {r.cost_cents ? <span className="mem-pill">{euro(r.cost_cents)}</span> : null}
                </div>
                <p>{`${r.garage_name} · ${day(r.performed_at)} · ${r.mileage.toLocaleString('en-FI')} km`}</p>
                <p>{r.summary}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="dash-help">No services recorded for this car yet.</p>
      )}
    </>
  );
}

export function GarageSheet({ garage: g, member = false }) {
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    api(`/garages/${g.id}/reviews`)
      .then(setReviews)
      .catch(() => setReviews(null));
  }, [g.id]);
  const today = WEEKDAYS[(new Date().getDay() + 6) % 7]?.[0];
  return (
    <div className="dx-sheet">
      <p className="dx-sheet-meta">
        <span className={`gt-pill ${g.open_now && g.online ? 'open' : ''}`}>
          {!g.online ? 'Not taking bookings' : g.open_now ? 'Open now' : 'Closed now'}
        </span>
        {g.verification === 'verified' && <span className="gt-pill open">Verified by MotoDoc</span>}
      </p>
      {(g.hourly_rate || g.member_rate) && (
        <>
          <h3>Rates</h3>
          <p>
            {g.hourly_rate ? `Standard €${g.hourly_rate}/h` : ''}
            {g.member_rate ? ` · Member €${g.member_rate}/h` : ''}
            {g.hourly_rate && g.member_rate ? ` (save €${g.hourly_rate - g.member_rate}/h)` : ''}
          </p>
        </>
      )}
      <h3>Contact</h3>
      <ul className="dx-contact">
        {g.phone && (
          <li>
            <PhoneIcon size={16} />
            <a href={`tel:${g.phone.replace(/\s/g, '')}`}>{g.phone}</a>
          </li>
        )}
        {g.email && (
          <li>
            <EnvelopeSimpleIcon size={16} />
            <a href={`mailto:${g.email}`}>{g.email}</a>
          </li>
        )}
        <li>
          <MapPinIcon size={16} />
          <span>
            {g.address && g.city && g.address.includes(g.city)
              ? g.address
              : [g.address, g.city].filter(Boolean).join(', ')}
          </span>
        </li>
      </ul>
      {g.memberships && !member && (
        <p className="dx-member">
          <strong>Become a member.</strong> Lower prices, priority booking and seasonal checks.{' '}
          <a href="#memberships">See plans</a>
        </p>
      )}
      {g.menu?.length > 0 && (
        <details>
          <summary>{`Services and prices (${g.menu.length})`}</summary>
          <ul className="dx-menu">
            {g.menu.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <span>
                  {s.price_min_cents != null
                    ? s.price_max_cents != null && s.price_max_cents !== s.price_min_cents
                      ? `€${s.price_min_cents / 100}–${s.price_max_cents / 100}`
                      : `from €${s.price_min_cents / 100}`
                    : 'Quote'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>
          {reviews?.count
            ? `Reviews · ${reviews.average} ★ (${reviews.count})`
            : 'Reviews · No reviews yet'}
        </summary>
        {reviews?.count > 0 && (
          <>
            <ul className="dx-breakdown">
              {reviews.breakdown.map(([stars, n]) => (
                <li key={stars}>
                  <span>{`${stars} ★`}</span>
                  <div className="fd-bar">
                    <span style={{ width: `${(n / reviews.count) * 100}%` }} />
                  </div>
                  <small>{n}</small>
                </li>
              ))}
            </ul>
            {reviews.latest.map((r, i) => (
              <blockquote key={i} className="dx-review">
                <p>
                  <StarIcon size={13} weight="fill" /> {`${r.rating}/5 · ${r.driver_name}`}
                </p>
                {r.tags.length > 0 && <small>{r.tags.join(' · ')}</small>}
                {r.comment && <p>{`“${r.comment}”`}</p>}
                {r.reply && <p className="gx-reply">{`Reply from ${g.name}: ${r.reply}`}</p>}
              </blockquote>
            ))}
          </>
        )}
      </details>
      {g.hours && (
        <details>
          <summary>Opening hours</summary>
          <ul className="dx-menu">
            {WEEKDAYS.map(([key, label]) => (
              <li key={key} className={key === today ? 'today' : ''}>
                <span>{label}</span>
                <span>
                  {g.hours[key]?.open ? `${g.hours[key].from}–${g.hours[key].to}` : 'Closed'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function MyMechanic({ data, book, chat, navigate, showGarage }) {
  const live = data.memberships.filter((m) => m.status === 'active');
  const lastBooking = [...data.bookings].sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))[0];
  const garageId = live[0]?.garage_id || lastBooking?.garage_id;
  const g = data.garages.find((x) => x.id === garageId);
  if (!g)
    return (
      <div className="dash-empty">
        <WrenchIcon size={30} />
        <h2>Your own mechanic, one tap away</h2>
        <p>Book a garage once, or join a garage membership, and your mechanic appears here.</p>
        <button className="button button-small" onClick={() => navigate('garages')}>
          Find a garage
        </button>
      </div>
    );
  const membership = live.find((m) => m.garage_id === g.id);
  const cars = data.vehicles.filter((v) =>
    membership
      ? membership.vehicles.some((x) => x.id === v.id)
      : data.bookings.some((b) => b.garage_id === g.id && b.vehicle_id === v.id),
  );
  const chatWith = data.bookings
    .filter((b) => b.garage_id === g.id && b.chat_open)
    .sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))[0];
  return (
    <>
      <article className="dash-tile dx-mechanic">
        <span className="eyebrow">{membership ? 'YOUR GARAGE · MEMBER' : 'YOUR GARAGE'}</span>
        <h2>{g.mechanic_name ? `${g.mechanic_name} at ${g.name}` : g.name}</h2>
        <p>
          {cars.length
            ? `Looks after your ${cars.map((v) => `${v.make} ${v.model}`).join(' and ')}`
            : g.city}
        </p>
        <div className="ex-buttons">
          {chatWith && (
            <button className="dash-secondary" onClick={() => chat(chatWith)}>
              <ChatCircleIcon size={16} /> Chat
            </button>
          )}
          <button className="button button-small" onClick={() => book(g)}>
            <CalendarBlankIcon size={16} /> Book service
          </button>
          <button className="dash-text-button" onClick={() => showGarage(g)}>
            Garage details
          </button>
        </div>
      </article>
      {membership && (
        <>
          <div className="dash-section-heading">
            <h2>Your benefits</h2>
            <Status>{membership.state}</Status>
          </div>
          <ul className="mem-benefits dash-tile">
            {[
              ...BASIC_BENEFITS,
              ...(membership.plan_kind === 'basic'
                ? []
                : [...FULL_EXTRAS, ...membership.benefits.split('\n').filter(Boolean)]),
            ].map((b) => (
              <li key={b}>
                <span>{`✓ ${b}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="dash-section-heading">
        <h2>Contact and hours</h2>
      </div>
      <div className="dash-tile">
        <GarageSheet garage={g} member={!!membership} />
      </div>
    </>
  );
}

export function MessagesPanel({ bookings, messages, user, isGarage, open }) {
  const threads = bookings
    .map((b) => {
      const list = messages.filter((m) => m.booking_id === b.id);
      return { b, last: list[list.length - 1], count: list.length };
    })
    .filter((t) => t.count || t.b.chat_open)
    .sort((a, z) => {
      if (!!a.last !== !!z.last) return a.last ? -1 : 1;
      const ka = a.last?.created_at || a.b.starts_at;
      const kz = z.last?.created_at || z.b.starts_at;
      return ka < kz ? 1 : -1;
    });
  if (!threads.length)
    return (
      <div className="dash-empty">
        <ChatCircleIcon size={30} />
        <h2>No messages yet</h2>
        <p>When you book a service you can chat with the garage here.</p>
      </div>
    );
  return (
    <>
      <p className="dash-help">
        {isGarage
          ? 'Chats with your customers, one per booking.'
          : 'Chat with your garages, one per booking.'}
      </p>
      <div className="dash-list">
        {threads.map(({ b, last, count }) => (
          <button className="dash-row dx-thread" key={b.id} onClick={() => open(b)}>
            <div className="dash-row-body">
              <div className="dash-row-title">
                <h3>{isGarage ? b.driver_name : b.garage_name}</h3>
                {!b.chat_open && <span className="mem-pill">Chat closed</span>}
                {count > 0 && <span className="mk-count">{count}</span>}
              </div>
              <p>{`${b.service} · ${b.registration}`}</p>
              <p className="dx-preview">
                {last
                  ? `${last.sender_id === user.id ? 'You: ' : ''}${last.body.slice(0, 90)}`
                  : 'Ask the garage about this booking'}
              </p>
            </div>
            <small>
              {last
                ? new Date(iso(last.created_at)).toDateString() === new Date().toDateString()
                  ? clock(last.created_at)
                  : day(last.created_at)
                : ''}
            </small>
          </button>
        ))}
      </div>
    </>
  );
}

export function WeekView({ bookings, details }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const key = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Helsinki' });
  const live = bookings.filter((b) => !['cancelled', 'declined', 'no_show'].includes(b.state));
  return (
    <div className="dx-week">
      <div className="dx-week-head">
        <button className="dash-text-button" onClick={() => setOffset(offset - 1)}>
          ← Previous
        </button>
        <strong>
          {`${days[0].toLocaleDateString('en-FI', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-FI', { day: 'numeric', month: 'short' })}`}
        </strong>
        <button className="dash-text-button" onClick={() => setOffset(offset + 1)}>
          Next →
        </button>
      </div>
      <div className="dx-week-grid">
        {days.map((d) => {
          const items = live
            .filter((b) => key(new Date(b.starts_at)) === key(d))
            .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
          return (
            <section key={key(d)} className={key(d) === key(now) ? 'today' : ''}>
              <h4>{d.toLocaleDateString('en-FI', { weekday: 'short', day: 'numeric' })}</h4>
              {items.length ? (
                items.map((b) => (
                  <button key={b.id} className={`dx-slot ${b.state}`} onClick={() => details(b)}>
                    <strong>{clock(b.starts_at)}</strong>
                    <span>{b.service}</span>
                    <small>{b.driver_name}</small>
                  </button>
                ))
              ) : (
                <small className="dx-free">No bookings</small>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function MonthView({ bookings, details }) {
  const [offset, setOffset] = useState(0),
    [pick, setPick] = useState('');
  const key = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Helsinki' });
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const live = bookings.filter((b) => !['cancelled', 'declined', 'no_show'].includes(b.state));
  const byDay = new Map();
  for (const b of live) {
    const k = key(new Date(b.starts_at));
    byDay.set(k, [...(byDay.get(k) || []), b]);
  }
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1, 12),
    ),
  ];
  const chosen = [...(byDay.get(pick) || [])].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  return (
    <div className="dx-week">
      <div className="dx-week-head">
        <button className="dash-text-button" onClick={() => setOffset(offset - 1)}>
          ← Previous
        </button>
        <strong>{first.toLocaleDateString('en-FI', { month: 'long', year: 'numeric' })}</strong>
        <button className="dash-text-button" onClick={() => setOffset(offset + 1)}>
          Next →
        </button>
      </div>
      <div className="dx-month">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={key(d)}
              className={`${key(d) === key(now) ? 'today' : ''} ${byDay.get(key(d)) ? 'busy' : ''}`}
              aria-pressed={pick === key(d)}
              onClick={() => setPick(key(d))}
            >
              <span>{d.getDate()}</span>
              {byDay.get(key(d)) && <small>{byDay.get(key(d)).length}</small>}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      {pick && (
        <div className="dx-month-day">
          <h4>
            {new Date(`${pick}T12:00:00`).toLocaleDateString('en-FI', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h4>
          {chosen.length ? (
            chosen.map((b) => (
              <button key={b.id} className={`dx-slot ${b.state}`} onClick={() => details(b)}>
                <strong>{clock(b.starts_at)}</strong>
                <span>{b.service}</span>
                <small>{b.driver_name}</small>
              </button>
            ))
          ) : (
            <small className="dx-free">No bookings</small>
          )}
        </div>
      )}
    </div>
  );
}

export function SetupChecklist({ user, data, navigate }) {
  const g = data['garage/profile'];
  const items =
    user.role === 'garage'
      ? [
          ['Publish your garage profile', !!g?.published, 'profile'],
          [
            'Add your services and prices',
            !!g?.menu?.some((s) => s.price_min_cents != null),
            'services',
          ],
          ['Set your hourly rate', !!g?.hourly_rate, 'profile'],
          ['Add a phone number for customers', !!g?.phone, 'profile'],
        ]
      : [
          ['Add your car', data.vehicles.length > 0, 'vehicles'],
          ['Add your phone number', !!user.phone, 'account'],
          ['Add your address', !!user.address, 'account'],
        ];
  const done = items.filter(([, ok]) => ok).length;
  if (done === items.length) return null;
  return (
    <article className="dash-tile dx-setup">
      <div className="dx-setup-head">
        <h2>Complete your setup</h2>
        <small>{`${done} of ${items.length} done`}</small>
      </div>
      <div className="fd-bar" aria-hidden="true">
        <span style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul>
        {items.map(([label, ok, target]) => (
          <li key={label} className={ok ? 'ok' : ''}>
            {ok ? (
              <span>{`✓ ${label}`}</span>
            ) : (
              <button className="dash-text-button" onClick={() => navigate(target)}>
                {label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
