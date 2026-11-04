import { useCallback, useEffect, useState } from 'react';
import { StarIcon } from '@phosphor-icons/react';
import { api } from './api.js';
import { Status } from './DashParts.jsx';
import { toast } from './Toasts.jsx';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const iso = (value) => (value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
const day = (value) =>
  value
    ? new Date(iso(value)).toLocaleDateString('en-FI', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Europe/Helsinki',
      })
    : '—';
const isNew = (c) => Date.now() - Date.parse(iso(c.first_booking)) < 30 * 86400000;

export function recordDialog(open, customers, services, preset = {}) {
  const people = customers.filter((c) => c.vehicles?.length);
  const options = people.flatMap((c) =>
    c.vehicles.map((v) => ({
      value: `${c.id}|${v.id}`,
      label: `${c.name} · ${v.make} ${v.model} · ${v.registration}`,
    })),
  );
  open({
    silent: true,
    title: 'Add a service record',
    note: 'For work done outside a booking. Records can only be added for your MotoDoc customers, and the customer sees it in their service history.',
    values: {
      who: preset.who || options[0]?.value || '',
      service: services[0] || '',
      performed_on: new Date().toISOString().slice(0, 10),
    },
    fields: [
      { name: 'who', label: 'Customer and car', required: true, options },
      {
        name: 'service',
        label: 'Service',
        required: true,
        options: services.map((s) => ({ value: s, label: s })),
      },
      { name: 'performed_on', label: 'Date', type: 'date', required: true },
      { name: 'mileage', label: 'Mileage (km)', type: 'number', min: 1, required: true },
      { name: 'cost', label: 'Cost (€)', type: 'number', min: 0, step: 0.01 },
      { name: 'parts', label: 'Parts used', maxLength: 500 },
      { name: 'summary', label: 'Work done', type: 'textarea', required: true, maxLength: 2000 },
    ],
    submit: 'Save record',
    save: async (d) => {
      const [driver_id, vehicle_id] = (d.who || '').split('|');
      if (!vehicle_id) throw new Error('Choose the customer and car.');
      await api('/service-records', {
        method: 'POST',
        body: {
          driver_id,
          vehicle_id,
          service: d.service,
          performed_on: d.performed_on,
          mileage: Number(d.mileage),
          ...(d.cost ? { cost: Number(d.cost) } : {}),
          parts: d.parts || '',
          summary: d.summary,
        },
      });
      toast('Service record added. The customer can see it now.');
    },
  });
}

export function CustomersPanel({ customers, bookings, open, act, services, canRecord }) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [expanded, setExpanded] = useState('');
  const counts = {
    all: customers.length,
    members: customers.filter((c) => c.member).length,
    others: customers.filter((c) => !c.member).length,
    new: customers.filter(isNew).length,
  };
  const list = customers
    .filter((c) =>
      filter === 'members'
        ? c.member
        : filter === 'others'
          ? !c.member
          : filter === 'new'
            ? isNew(c)
            : true,
    )
    .filter((c) =>
      `${c.name} ${c.email} ${c.phone || ''} ${c.vehicles.map((v) => `${v.make} ${v.model} ${v.registration}`).join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  return (
    <>
      <div className="dash-section-heading">
        <p className="dash-help">MotoDoc users who have booked with you and your members.</p>
        <a className="dash-secondary" href="#refer">
          Invite customers
        </a>
      </div>
      <div className="ac-filters">
        <label className="dash-search">
          Search customers
          <input
            type="search"
            placeholder="Name, email, phone, car or plate"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="mk-tabs md-scroll-x" role="tablist">
        {[
          ['all', 'All'],
          ['members', 'Garage members'],
          ['others', 'Non-members'],
          ['new', 'New customers'],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="mk-count">{counts[key]}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="dash-list">
          {list.map((c) => {
            const theirs = bookings
              .filter((b) => b.driver_id === c.id)
              .sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))
              .slice(0, 4);
            return (
              <article className="dash-row gx-customer" key={c.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{c.name}</h3>
                    {c.member ? <span className="mem-pill">Member</span> : null}
                    {isNew(c) && <span className="mem-pill">New</span>}
                  </div>
                  <p>{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
                  <p>
                    {`${c.vehicles.map((v) => v.registration).join(', ') || 'No cars'} · ${euro(c.spent_cents || 0)} total spent`}
                  </p>
                </div>
                <div className="ex-buttons">
                  <button
                    className="dash-text-button"
                    onClick={() => setExpanded(expanded === c.id ? '' : c.id)}
                  >
                    {expanded === c.id ? 'Hide' : 'Details'}
                  </button>
                </div>
                {expanded === c.id && (
                  <div className="ex-detail">
                    <dl className="mk-summary">
                      <dt>Customer since</dt>
                      <dd>{day(c.first_booking)}</dd>
                      <dt>Last visit</dt>
                      <dd>{day(c.last_visit)}</dd>
                      <dt>Membership</dt>
                      <dd>{c.member ? 'Active member' : 'Not a member'}</dd>
                      <dt>Total spent</dt>
                      <dd>{euro(c.spent_cents || 0)}</dd>
                      <dt>Cars</dt>
                      <dd>
                        {c.vehicles
                          .map((v) => `${v.make} ${v.model} · ${v.registration}`)
                          .join(', ') || '—'}
                      </dd>
                      {c.mechanic_notes && (
                        <>
                          <dt>From the customer</dt>
                          <dd>{c.mechanic_notes}</dd>
                        </>
                      )}
                      <dt>Internal notes</dt>
                      <dd>{c.notes || 'No notes yet. Only your team can see notes.'}</dd>
                    </dl>
                    {theirs.length > 0 && (
                      <ul className="gx-bookings">
                        {theirs.map((b) => (
                          <li key={b.id}>
                            <span>{`${b.service} · ${day(b.starts_at)}`}</span>
                            <Status>{b.status}</Status>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="ex-buttons">
                      <button
                        className="dash-text-button"
                        onClick={() =>
                          open({
                            title: `Notes for ${c.name}`,
                            note: 'These notes are private to your garage.',
                            values: c,
                            fields: [
                              { name: 'tags', label: 'Tags', maxLength: 300 },
                              {
                                name: 'notes',
                                label: 'Customer notes',
                                type: 'textarea',
                                maxLength: 3000,
                              },
                            ],
                            save: (d) => act(`/customers/${c.id}`, d, 'PUT'),
                          })
                        }
                      >
                        {c.notes ? 'Edit note' : 'Add note'}
                      </button>
                      <button
                        className="dash-text-button"
                        onClick={() =>
                          open({
                            silent: true,
                            title: `Set a reminder for ${c.name}`,
                            note: 'They see it in their reminders and get a notification.',
                            values: { type: 'other' },
                            fields: [
                              { name: 'title', label: 'Reminder', required: true, maxLength: 160 },
                              {
                                name: 'type',
                                label: 'Type',
                                required: true,
                                options: [
                                  ['oil', 'Oil change'],
                                  ['tyres', 'Tyre change'],
                                  ['inspection', 'Inspection'],
                                  ['other', 'Other'],
                                ].map(([value, label]) => ({ value, label })),
                              },
                              { name: 'due_date', label: 'Date', type: 'date', required: true },
                              ...(c.vehicles.length
                                ? [
                                    {
                                      name: 'vehicle_id',
                                      label: 'Car (optional)',
                                      options: c.vehicles.map((v) => ({
                                        value: v.id,
                                        label: `${v.make} ${v.model} · ${v.registration}`,
                                      })),
                                    },
                                  ]
                                : []),
                              { name: 'note', label: 'Note (optional)', maxLength: 500 },
                            ],
                            submit: 'Send reminder',
                            save: async (d) => {
                              await api(`/customers/${c.id}/reminders`, {
                                method: 'POST',
                                body: {
                                  title: d.title,
                                  type: d.type,
                                  due_date: d.due_date,
                                  note: d.note || '',
                                  ...(d.vehicle_id ? { vehicle_id: d.vehicle_id } : {}),
                                },
                              });
                              toast(`Reminder sent to ${c.name}`);
                            },
                          })
                        }
                      >
                        Set reminder
                      </button>
                      {canRecord && c.vehicles.length > 0 && (
                        <button
                          className="dash-text-button"
                          onClick={() =>
                            recordDialog(open, customers, services, {
                              who: `${c.id}|${c.vehicles[0].id}`,
                            })
                          }
                        >
                          Add service record
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dash-help">No customers match.</p>
      )}
    </>
  );
}

export function ReviewsPanel({ open }) {
  const [data, setData] = useState(null),
    [filter, setFilter] = useState('all');
  const load = useCallback(
    () =>
      api('/garage/reviews')
        .then(setData)
        .catch((e) => toast(e.message, 'error')),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!data) return <p className="dash-help">Loading reviews…</p>;
  const total = data.breakdown.reduce((s, [, n]) => s + n, 0);
  const needReply = data.reviews.filter((r) => !r.reply && !r.hidden);
  const list = filter === 'reply' ? needReply : data.reviews;
  const reply = (r) =>
    open({
      silent: true,
      title: `Reply to ${r.driver_name}`,
      note: 'Your reply is public and shown under the review. You can reply once.',
      fields: [
        { name: 'reply', label: 'Your reply', type: 'textarea', required: true, maxLength: 1000 },
      ],
      submit: 'Post reply',
      save: async (d) => {
        await api(`/bookings/${r.booking_id}/review/reply`, { method: 'POST', body: d });
        toast('Reply posted');
        await load();
      },
    });
  return (
    <>
      <div className="gx-rating">
        <div>
          <strong>{data.average ?? '—'}</strong>
          <small>{`${total} ${total === 1 ? 'review' : 'reviews'}`}</small>
        </div>
        <ul>
          {data.breakdown.map(([stars, n]) => (
            <li key={stars}>
              <span>{`${stars} ★`}</span>
              <div className="fd-bar">
                <span style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
              </div>
              <small>{n}</small>
            </li>
          ))}
        </ul>
      </div>
      <div className="mk-tabs md-scroll-x" role="tablist">
        {[
          ['all', 'All', data.reviews.length],
          ['reply', 'Needs reply', needReply.length],
        ].map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="mk-count">{n}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="dash-list">
          {list.map((r) => (
            <article className="dash-row" key={r.booking_id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>
                    <StarIcon size={15} weight="fill" className="gx-star" />
                    {` ${r.rating}/5 · ${r.service}`}
                  </h3>
                  {r.hidden && <span className="mem-pill">Hidden by MotoDoc</span>}
                </div>
                <p>{`${r.driver_name} · ${day(r.created_at)}`}</p>
                {r.tags.length > 0 && <p>{r.tags.join(' · ')}</p>}
                {r.comment && <p>{`“${r.comment}”`}</p>}
                {r.reply && <p className="gx-reply">{`Your reply: ${r.reply}`}</p>}
              </div>
              {!r.reply && !r.hidden && (
                <div className="ex-buttons">
                  <button className="dash-text-button" onClick={() => reply(r)}>
                    Reply publicly
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="dash-help">
          {filter === 'reply' ? 'All reviews have a reply.' : 'No reviews yet.'}
        </p>
      )}
    </>
  );
}
