import { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheckIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CrownIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  ThumbsUpIcon,
  UmbrellaIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Status } from './DashParts.jsx';
import { toast } from './Toasts.jsx';
import { COMING_SOON, FREE_LIMITS, PLAN_FEATURES, PRIORITY } from './extras.js';
import './extras-panels.css';

const euro = (value) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
const dayText = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-FI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const daysUntil = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.now()) / 86400000);

function useLoad(path) {
  const [data, setData] = useState(null);
  const load = useCallback(
    () =>
      api(path)
        .then(setData)
        .catch((e) => toast(e.message, 'error')),
    [path],
  );
  useEffect(() => {
    load();
  }, [load]);
  return [data, load];
}

export function PlanPanel({ open }) {
  const [info, load] = useLoad('/subscription');
  const [yearly, setYearly] = useState(false);
  if (!info) return <p className="dash-help">Loading your plan…</p>;
  const features = PLAN_FEATURES[info.role];
  const month = info.price_month;
  const year = Math.round(month * 10 * 100) / 100;
  const change = (plan) =>
    open({
      silent: true,
      title: plan === 'pro' ? 'Switch to Pro?' : 'Switch to the Free plan?',
      note:
        plan === 'pro'
          ? info.launch_bonus
            ? 'Pro is free during our launch. You won’t be charged.'
            : ''
          : info.role === 'driver'
            ? `The Free plan covers up to ${FREE_LIMITS.vehicles} cars and ${FREE_LIMITS.bookings} bookings a month.`
            : `The Free plan is meant for up to ${FREE_LIMITS.customers} customers.`,
      submit: plan === 'pro' ? 'Switch to Pro' : 'Switch to Free',
      save: async () => {
        await api('/subscription', {
          method: 'PUT',
          body: { plan, period: yearly ? 'yearly' : 'monthly' },
        });
        toast(plan === 'pro' ? 'Welcome to MotoDoc Pro!' : 'Switched to Free plan.');
        await load();
      },
    });
  const usage =
    info.role === 'driver'
      ? [
          `${info.usage.vehicles} of ${FREE_LIMITS.vehicles} cars`,
          `${info.usage.bookings} of ${FREE_LIMITS.bookings} bookings this month`,
        ]
      : [`${info.usage.customers} of ${FREE_LIMITS.customers} customers`];
  return (
    <>
      {info.launch_bonus && (
        <article className="dash-tile ex-bonus">
          <CrownIcon size={24} />
          <p>
            <strong>Launch bonus:</strong> everyone gets Pro for free while MotoDoc is new.
          </p>
        </article>
      )}
      <div className="dash-section-heading">
        <h2>Choose your plan</h2>
        <div className="mem-toggle" role="group" aria-label="Billing period">
          <button aria-pressed={!yearly} onClick={() => setYearly(false)}>
            Monthly
          </button>
          <button aria-pressed={yearly} onClick={() => setYearly(true)}>
            Yearly · Save 17%
          </button>
        </div>
      </div>
      <div className="ex-plans">
        {['free', 'pro'].map((key) => {
          const current = info.plan === key;
          return (
            <article className={`ex-plan${key === 'pro' ? ' featured' : ''}`} key={key}>
              {key === 'pro' && (
                <span className="mem-recommended">
                  <ThumbsUpIcon size={14} /> Recommended
                </span>
              )}
              <h3>{key === 'pro' ? 'Pro' : 'Free'}</h3>
              <strong className="mem-plan-price">
                {key === 'free'
                  ? euro(0)
                  : info.launch_bonus
                    ? `${euro(0)} during launch`
                    : yearly
                      ? `${euro(year)} / year`
                      : `${euro(month)} / month`}
              </strong>
              {key === 'pro' && info.launch_bonus && (
                <small>{`Then ${yearly ? `${euro(year)} / year` : `${euro(month)} / month`}`}</small>
              )}
              <ul className="mem-benefits">
                {features[key].map((f) => (
                  <li key={f}>
                    <CheckIcon size={15} weight="bold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {current ? (
                <span className="ex-current">Current plan</span>
              ) : info.can_change ? (
                <button
                  className={key === 'pro' ? 'button button-small' : 'dash-secondary'}
                  onClick={() => change(key)}
                >
                  {key === 'pro' ? 'Upgrade to Pro' : 'Switch to Free'}
                </button>
              ) : (
                <small>Only the garage owner can change the plan.</small>
              )}
            </article>
          );
        })}
      </div>
      {info.plan === 'free' && (
        <p className="dash-help">{`You’re using ${usage.join(' and ')}.`}</p>
      )}
      {!info.launch_bonus && (
        <p className="dash-help">
          Pro can’t be bought online yet because payments aren’t connected. It will be available
          soon.
        </p>
      )}
    </>
  );
}

export function RecommendationsPanel({ navigate }) {
  const [cars] = useLoad('/recommendations');
  const [pick, setPick] = useState('');
  const [item, setItem] = useState(null);
  if (!cars) return <p className="dash-help">Working out what your cars need…</p>;
  if (!cars.length)
    return (
      <div className="dash-empty">
        <p>Add your car to see what it needs and when.</p>
        <button className="button button-small" onClick={() => navigate('vehicles')}>
          Add your car
        </button>
      </div>
    );
  const car = cars.find((c) => c.vehicle.id === pick) || cars[0];
  return (
    <>
      <p className="dash-help">
        Based on your car’s mileage, condition, service history and the season. Estimates are
        typical Finnish prices; your garage confirms the final price.
      </p>
      {cars.length > 1 && (
        <div className="mem-chips md-scroll-x" role="tablist" aria-label="Your cars">
          {cars.map((c) => (
            <button
              key={c.vehicle.id}
              role="tab"
              aria-selected={c.vehicle.id === car.vehicle.id}
              className={c.vehicle.id === car.vehicle.id ? 'active' : ''}
              onClick={() => setPick(c.vehicle.id)}
            >
              {`${c.vehicle.make} ${c.vehicle.model} · ${c.vehicle.registration}`}
            </button>
          ))}
        </div>
      )}
      {PRIORITY.map(([key, label]) => {
        const list = car.items.filter((i) => i.priority === key);
        if (!list.length) return null;
        return (
          <section key={key}>
            <div className="dash-section-heading">
              <h2>{label}</h2>
            </div>
            <div className="dash-list">
              {list.map((i) => (
                <article className="dash-row" key={i.id}>
                  <div className="dash-row-body">
                    <div className="dash-row-title">
                      <h3>{i.title}</h3>
                      <span className={`ex-priority ${i.priority}`}>{label}</span>
                    </div>
                    <p>{i.next_due}</p>
                    <p>{`About ${euro(i.estimate[0])}–${euro(i.estimate[1])}`}</p>
                  </div>
                  <div className="ex-buttons">
                    <button
                      className="dash-text-button"
                      onClick={() => setItem(item?.id === i.id ? null : i)}
                    >
                      {item?.id === i.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {item?.id === i.id && (
                    <div className="ex-detail">
                      <dl className="mk-summary">
                        <dt>Estimated cost</dt>
                        <dd>{`${euro(i.estimate[0])}–${euro(i.estimate[1])}`}</dd>
                        <dt>Last done</dt>
                        <dd>
                          {i.last_done
                            ? `${dayText(i.last_done.date)} · ${i.last_done.mileage.toLocaleString('en-FI')} km`
                            : 'Not on record'}
                        </dd>
                        <dt>Interval</dt>
                        <dd>{i.interval}</dd>
                        <dt>Next due</dt>
                        <dd>{i.next_due}</dd>
                        <dt>Why it matters</dt>
                        <dd>{i.why}</dd>
                        <dt>Tip</dt>
                        <dd>{i.tip}</dd>
                      </dl>
                      <button className="button button-small" onClick={() => navigate('garages')}>
                        Book this service
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function InspectionsPanel({ open }) {
  const [cars] = useLoad('/recommendations');
  if (!cars) return <p className="dash-help">Loading…</p>;
  const remind = (c) =>
    open({
      silent: true,
      title: `Inspection reminder · ${c.vehicle.registration}`,
      note: 'Check your car’s inspection period on Traficom’s website or the registration certificate.',
      values: { due_date: c.mot_due || '' },
      fields: [{ name: 'due_date', label: 'Inspection due by', type: 'date', required: true }],
      submit: 'Set reminder',
      save: async (d) => {
        await api('/reminders', {
          method: 'POST',
          body: { title: `Katsastus · ${c.vehicle.registration}`, due_date: d.due_date },
        });
        toast('Reminder set. We’ll remind you a week before.');
      },
    });
  return (
    <>
      <p className="dash-help">
        Every car in Finland needs a regular inspection (katsastus). See when yours is due and get a
        reminder in time.
      </p>
      {cars.length ? (
        <div className="dash-list">
          {cars.map((c) => {
            const days = c.mot_due ? daysUntil(c.mot_due) : null;
            return (
              <article className="dash-row" key={c.vehicle.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{`${c.vehicle.make} ${c.vehicle.model} · ${c.vehicle.registration}`}</h3>
                    {days != null && (
                      <Status>{days < 0 ? 'overdue' : days <= 30 ? 'due soon' : 'on track'}</Status>
                    )}
                  </div>
                  <p>
                    {c.mot_due
                      ? days < 0
                        ? `Overdue since ${dayText(c.mot_due)}`
                        : `Due by ${dayText(c.mot_due)} · in ${days} days`
                      : 'No inspection date yet'}
                  </p>
                </div>
                <div className="ex-buttons">
                  <button className="dash-text-button" onClick={() => remind(c)}>
                    Set a reminder
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dash-help">Add your car to track its inspection.</p>
      )}
      <div className="dash-section-heading">
        <h2>Coming soon</h2>
      </div>
      <div className="ex-soon">
        {COMING_SOON.map(([key, title, text]) => {
          const Icon =
            key === 'insurance' ? UmbrellaIcon : key === 'tax' ? ReceiptIcon : CalendarCheckIcon;
          return (
            <article className="dash-tile" key={key}>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="mem-pill">Coming soon</span>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function PayLaterCard({ invoices }) {
  const unpaid = (invoices || []).filter((i) => i.state === 'unpaid' || i.state === 'overdue');
  return (
    <article className="dash-tile ex-paylater">
      <ClockIcon size={24} />
      <div>
        <h3>Pay later</h3>
        <p>
          Split a repair bill or pay it in 30 days with Klarna, right from your invoice. Pay later
          arrives when online payments are connected. Until then, pay by bank transfer with the
          reference number on the invoice.
        </p>
        {unpaid.length > 0 && (
          <p className="dash-help">
            {`${unpaid.length} ${unpaid.length === 1 ? 'invoice' : 'invoices'} ready to pay: ${euro(
              unpaid.reduce((s, i) => s + i.totals.total, 0) / 100,
            )}`}
          </p>
        )}
      </div>
    </article>
  );
}

export function ReferPanel({ user }) {
  const [info, load] = useLoad('/referrals');
  const [form, setForm] = useState({ email: '', kind: 'driver' });
  const [busy, setBusy] = useState(false);
  if (!info) return <p className="dash-help">Loading…</p>;
  const link = (kind) => `${location.origin}/join?ref=${info.code}&as=${kind}`;
  const copy = async (kind) => {
    try {
      await navigator.clipboard.writeText(link(kind));
      toast('Link copied');
    } catch {
      window.prompt('Copy this link', link(kind));
    }
  };
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/referrals', { method: 'POST', body: form });
      toast(
        r.already
          ? 'They’re already on MotoDoc, so we marked them as joined.'
          : 'Invite saved. Send them your link so they can join.',
      );
      setForm({ ...form, email: '' });
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const resend = async (r) => {
    try {
      await api(`/referrals/${r.id}/resend`, { method: 'POST', body: {} });
      await copy(r.kind);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const joined = info.invites.filter((i) => i.joined_at).length;
  return (
    <>
      <p className="dash-help">
        {user.role === 'garage'
          ? 'Invite other garages and drivers who aren’t on MotoDoc yet. MotoDoc doesn’t email invites yet, so share your link with them.'
          : 'Invite friends and garages you trust. MotoDoc doesn’t email invites yet, so share your link with them.'}
      </p>
      <article className="dash-tile ex-links">
        <h3>Your personal links</h3>
        {['driver', 'garage'].map((kind) => (
          <div className="ex-link" key={kind}>
            <span>{kind === 'driver' ? 'For drivers' : 'For garages'}</span>
            <code>{link(kind)}</code>
            <button className="dash-text-button" onClick={() => copy(kind)}>
              <CopyIcon size={15} /> Copy
            </button>
          </div>
        ))}
      </article>
      <form className="dash-tile ex-invite" onSubmit={send}>
        <h3>Who are you inviting?</h3>
        <div className="mk-tabs" role="radiogroup">
          {[
            ['driver', user.role === 'garage' ? 'A driver or customer' : 'A driver'],
            ['garage', 'Another garage'],
          ].map(([kind, label]) => (
            <button
              type="button"
              key={kind}
              role="radio"
              aria-checked={form.kind === kind}
              className={form.kind === kind ? 'active' : ''}
              onClick={() => setForm({ ...form, kind })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="dash-field">
          Email
          <input
            type="email"
            required
            maxLength={254}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <button className="button button-small" disabled={busy}>
          Save invite
        </button>
      </form>
      <div className="dash-section-heading">
        <h2>Your invites</h2>
      </div>
      <p className="dash-help">{`${joined} of ${info.invites.length} joined`}</p>
      {info.invites.length ? (
        <div className="dash-list">
          {info.invites.map((r) => (
            <article className="dash-row" key={r.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{r.email}</h3>
                  <span className="mem-pill">{r.kind === 'garage' ? 'Garage' : 'Driver'}</span>
                  {r.joined_at ? (
                    <span className="ex-joined">
                      <ShieldCheckIcon size={14} /> Joined
                    </span>
                  ) : (
                    <Status>invited</Status>
                  )}
                </div>
                <p>{`Invited ${dayText(r.created_at.slice(0, 10))}`}</p>
              </div>
              {!r.joined_at && (
                <div className="ex-buttons">
                  <button className="dash-text-button" onClick={() => resend(r)}>
                    Resend
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="dash-help">No invites yet.</p>
      )}
    </>
  );
}
