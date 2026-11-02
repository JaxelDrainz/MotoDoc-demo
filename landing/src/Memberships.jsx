import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CarIcon,
  CheckIcon,
  CrownIcon,
  GiftIcon,
  PaperPlaneTiltIcon,
  ThumbsUpIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Status } from './DashParts.jsx';
import { toast } from './Toasts.jsx';
import { BASIC_BENEFITS, FULL_EXTRAS, REFUND_REASONS, UPDATE_AUDIENCES } from './membership.js';
import './memberships.css';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-FI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Helsinki',
  });
const monthYear = (iso) =>
  new Date(iso).toLocaleDateString('en-FI', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Helsinki',
  });
const lines = (text) => (text || '').split('\n').filter(Boolean);
const carName = (v) => `${v.make} ${v.model} · ${v.registration}`;
const NO_PAYMENTS =
  'Online payments aren’t connected yet, so no money is taken now. The garage arranges payment with you.';

function Benefits({ items, extra }) {
  return (
    <ul className="mem-benefits">
      {items.map((b) => (
        <li key={b}>
          <CheckIcon size={15} weight="bold" />
          <span>{b}</span>
        </li>
      ))}
      {extra?.map((b) => (
        <li key={b} className="mem-perk">
          <GiftIcon size={15} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function stateNote(m) {
  if (m.state === 'refunded') return `Refund of ${euro(m.refund_cents)} requested.`;
  if (m.state === 'ended') return `Ended ${longDate(m.ended_at || m.renews_at)}.`;
  if (m.garage_stopped)
    return `${m.garage_name} stopped offering memberships. Your benefits stay until ${longDate(m.renews_at)}.`;
  if (m.state === 'ends')
    return `Cancelled. Your benefits stay until ${longDate(m.renews_at)}, and it won’t renew.`;
  return `Renews ${longDate(m.renews_at)}`;
}

function garageNote(m) {
  if (m.state === 'refunded') return `Asked for a refund of ${euro(m.refund_cents)}.`;
  if (m.state === 'ended') return `Ended ${longDate(m.ended_at || m.renews_at)}.`;
  if (m.state === 'ends') return `Ends ${longDate(m.renews_at)}, won’t renew.`;
  return `Renews ${longDate(m.renews_at)}`;
}

export function DriverMemberships({ data, open, navigate, reload }) {
  const live = data.memberships.filter((m) => m.status === 'active');
  const past = data.memberships.filter((m) => m.status !== 'active');
  const [pick, setPick] = useState(live[0]?.id);
  const [monthly, setMonthly] = useState(false);
  const current = live.find((m) => m.id === pick) || live[0];
  const shown = (cents) =>
    monthly ? `${euro(Math.round(cents / 12))} / month` : `${euro(cents)} / year`;

  const garages = [];
  for (const p of data.plans) {
    let g = garages.find((x) => x.id === p.garage_id);
    if (!g)
      garages.push(
        (g = {
          id: p.garage_id,
          name: p.garage_name,
          city: p.garage_city,
          rate: p.hourly_rate_cents,
          member: p.member_rate_cents,
          plans: [],
        }),
      );
    g.plans.push(p);
  }
  const coveredAt = (garageId) =>
    new Set(
      live.filter((m) => m.garage_id === garageId).flatMap((m) => m.vehicles.map((v) => v.id)),
    );

  const join = (plan, garage) => {
    const covered = coveredAt(garage.id);
    const cars = data.vehicles.filter((v) => !covered.has(v.id));
    if (!data.vehicles.length) return toast('Add a car first to join a membership.', 'error');
    if (!cars.length) return toast('All your cars are already covered here.', 'error');
    open({
      silent: true,
      title: `Join ${plan.kind === 'basic' ? 'Basic' : plan.name}`,
      note: `${euro(plan.price_cents)} a year for each car. ${NO_PAYMENTS}`,
      values: { vehicle_ids: cars.length === 1 ? [cars[0].id] : [], billing: 'yearly' },
      fields: [
        {
          name: 'vehicle_ids',
          label: 'Which cars should it cover?',
          type: 'checkboxes',
          options: cars.map((v) => ({ value: v.id, label: carName(v) })),
        },
        {
          name: 'billing',
          label: 'How would you like to pay?',
          required: true,
          options: [
            { value: 'yearly', label: 'Once a year' },
            { value: 'instalments', label: 'In 3 instalments' },
          ],
        },
      ],
      submit: 'Join',
      save: async (d) => {
        if (!d.vehicle_ids.length) throw new Error('Choose at least one car to cover.');
        const r = await api('/memberships', {
          method: 'POST',
          body: { plan_id: plan.id, vehicle_ids: d.vehicle_ids, billing: d.billing },
        });
        toast(`You joined ${plan.kind === 'basic' ? 'Basic' : r.plan_name} · ${r.garage_name}`);
      },
    });
  };
  const cancel = (m) =>
    open({
      silent: true,
      title: 'Cancel your membership?',
      cancel: 'Keep my membership',
      note: `You keep your benefits until ${longDate(m.renews_at)}. After that you won’t be charged again.`,
      submit: 'Cancel membership',
      save: async () => {
        await api(`/memberships/${m.id}/cancel`, { method: 'POST', body: {} });
        toast('Membership cancelled');
      },
    });
  const keep = async (m) => {
    try {
      await api(`/memberships/${m.id}/resume`, { method: 'POST', body: {} });
      toast('Your membership continues');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const refund = (m) =>
    open({
      silent: true,
      title: 'Request a refund',
      note: `Your membership at ${m.garage_name} ends now and ${euro(m.price_cents)} is marked for refund. ${NO_PAYMENTS.replace('arranges payment', 'settles the refund')}`,
      fields: [
        {
          name: 'reason',
          label: 'Why are you asking for a refund?',
          required: true,
          options: REFUND_REASONS.map(([value, label]) => ({ value, label })),
        },
      ],
      submit: 'Request refund',
      save: async (d) => {
        const r = await api(`/memberships/${m.id}/refund`, { method: 'POST', body: d });
        toast(`Refund requested — ${euro(r.refund_cents)}`);
      },
    });

  return (
    <>
      {current ? (
        <>
          {live.length > 1 && (
            <div className="mem-chips md-scroll-x" role="tablist" aria-label="Your memberships">
              {live.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={m.id === current.id}
                  className={m.id === current.id ? 'active' : ''}
                  onClick={() => setPick(m.id)}
                >
                  {m.garage_name} · {m.plan_kind === 'basic' ? 'Basic' : 'Full'}
                </button>
              ))}
            </div>
          )}
          <article className="dash-tile mem-current">
            <div className="mem-current-head">
              <CrownIcon size={26} />
              <div>
                <span className="eyebrow">YOUR MEMBERSHIP</span>
                <h2>{current.garage_name}</h2>
                <p>{current.plan_kind === 'basic' ? 'Basic' : current.plan_name}</p>
              </div>
              <Status>{current.state}</Status>
            </div>
            <p className={current.state === 'active' ? 'dash-help' : 'mem-note'}>
              {stateNote(current)}
            </p>
            <p className="mem-cars">
              <CarIcon size={17} />
              <span>{`Covers ${current.vehicles.map(carName).join(', ') || 'no cars'}`}</span>
            </p>
            <Benefits
              items={
                current.plan_kind === 'basic' ? BASIC_BENEFITS : [...BASIC_BENEFITS, ...FULL_EXTRAS]
              }
              extra={current.plan_kind === 'basic' ? [] : lines(current.benefits)}
            />
            <p className="mem-price">
              {current.billing === 'instalments'
                ? `3 × ${euro(Math.round(current.price_cents / 3))} a year`
                : `${euro(current.price_cents)} a year`}
              <small>{`Member since ${monthYear(current.member_since)}`}</small>
            </p>
            <div className="mem-buttons">
              {current.state === 'ends' && !current.garage_stopped && current.offering && (
                <button className="button button-small" onClick={() => keep(current)}>
                  Keep my membership
                </button>
              )}
              {current.auto_renew && (
                <button className="dash-text-button" onClick={() => cancel(current)}>
                  Cancel membership
                </button>
              )}
              <button className="dash-text-button muted" onClick={() => refund(current)}>
                Request a refund
              </button>
            </div>
          </article>
        </>
      ) : (
        <article className="dash-tile mem-hero">
          <CrownIcon size={28} />
          <span className="eyebrow">GARAGE MEMBERSHIP</span>
          <h2>Your own mechanic, one tap away</h2>
          <p>
            Join a garage you trust. Chat with your mechanic directly, pay member prices and get
            seen first.
          </p>
          <ul className="mem-benefits">
            {[
              'Direct chat with your mechanic',
              'Member prices on labour and services',
              'Priority booking when you need it',
              'Seasonal checks and reminders',
            ].map((b) => (
              <li key={b}>
                <CheckIcon size={15} weight="bold" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="dash-section-heading">
        <h2>Choose your garage</h2>
        <div className="mem-toggle" role="group" aria-label="Show prices">
          <button aria-pressed={!monthly} onClick={() => setMonthly(false)}>
            Yearly
          </button>
          <button aria-pressed={monthly} onClick={() => setMonthly(true)}>
            Monthly
          </button>
        </div>
      </div>
      <p className="dash-help">
        {monthly
          ? 'Billed once a year only. Monthly shows the cost per month.'
          : 'Each plan is priced per car and billed once a year, or in 3 instalments. You can cancel any time.'}
      </p>
      {garages.length ? (
        garages.map((g) => (
          <section className="mem-garage" key={g.id}>
            <header>
              <h3>{g.name}</h3>
              <p>
                {g.city}
                {g.rate ? ` · Standard ${euro(g.rate)}/h` : ''}
                {g.member ? ` · Member ${euro(g.member)}/h` : ''}
              </p>
            </header>
            <div className="mem-plans">
              {g.plans.map((p) => {
                const basic = p.kind === 'basic';
                const mine = live.some((m) => m.plan_id === p.id);
                return (
                  <article className={`mem-plan${basic ? '' : ' featured'}`} key={p.id}>
                    <span className="eyebrow">
                      {basic ? 'GARAGE ESSENTIALS' : 'GARAGE MEMBERSHIP'}
                    </span>
                    {!basic && (
                      <span className="mem-recommended">
                        <ThumbsUpIcon size={14} /> Recommended
                      </span>
                    )}
                    <h4>{basic ? 'Basic' : p.name}</h4>
                    <p className="mem-plan-sub">
                      {basic
                        ? 'Set by MotoDoc, the same at every garage'
                        : g.member && g.rate
                          ? `Member rate ${euro(g.member)}/h instead of ${euro(g.rate)}/h`
                          : 'Full membership'}
                    </p>
                    <strong className="mem-plan-price">{shown(p.price_cents)}</strong>
                    <small>per car</small>
                    <Benefits
                      items={basic ? BASIC_BENEFITS : [...BASIC_BENEFITS, ...FULL_EXTRAS]}
                      extra={basic ? [] : lines(p.benefits)}
                    />
                    <button
                      className={basic ? 'dash-secondary' : 'button button-small'}
                      onClick={() => join(p, g)}
                    >
                      {mine ? 'Add another car' : basic ? 'Join Basic' : `Join ${g.name}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="dash-empty">
          <p>No garages offer memberships near you yet.</p>
          <button className="button button-small" onClick={() => navigate('garages')}>
            Find a garage <ArrowRightIcon size={16} />
          </button>
        </div>
      )}
      {past.length > 0 && (
        <>
          <div className="dash-section-heading">
            <h2>Past memberships</h2>
          </div>
          <div className="dash-list">
            {past.map((m) => (
              <article className="dash-row" key={m.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{m.garage_name}</h3>
                    <Status>{m.state}</Status>
                  </div>
                  <p>{m.plan_kind === 'basic' ? 'Basic' : m.plan_name}</p>
                  <p>{stateNote(m)}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function GarageMemberships({ data, open, user }) {
  const [info, setInfo] = useState(null);
  const load = useCallback(
    () =>
      api('/garage/membership')
        .then(setInfo)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    load();
  }, [load, data.memberships]);
  if (!info) return <p className="dash-help">Loading your membership…</p>;
  if (!info.launched_at)
    return (
      <article className="dash-tile dash-launch">
        <GiftIcon size={28} />
        <div>
          <h2>Turn your regulars into members.</h2>
          <p>Lock in customers for a year. Get paid for loyalty you already earn.</p>
        </div>
        {user.garageRole === 'owner' ? (
          <a className="button button-small" href="/onboarding/membership">
            Set up your membership <ArrowRightIcon size={16} />
          </a>
        ) : (
          <p className="dash-help">Ask the garage owner to set up your membership.</p>
        )}
      </article>
    );

  const owner = user.garageRole === 'owner';
  const members = data.memberships;
  const live = members.filter((m) => m.status === 'active');
  const plan = info.plan;
  const after = async (message) => {
    toast(message);
    await load();
  };
  const editPlan = () =>
    open({
      silent: true,
      title: 'Edit your plan',
      note: 'Drivers see the new prices straight away. Current members keep the yearly price they paid until renewal.',
      values: {
        price: plan.price_cents / 100,
        hourly_rate: info.hourly_rate ?? '',
        member_rate: info.member_rate ?? '',
        perks: plan.benefits,
      },
      fields: [
        {
          name: 'price',
          label: 'Yearly price per car (€29–59)',
          type: 'number',
          min: 29,
          max: 59,
          step: 1,
          required: true,
        },
        {
          name: 'hourly_rate',
          label: 'Hourly rate (€, incl. VAT)',
          type: 'number',
          min: 1,
          step: 1,
          required: true,
        },
        {
          name: 'member_rate',
          label: 'Member hourly rate (€)',
          type: 'number',
          min: 1,
          step: 1,
          required: true,
        },
        {
          name: 'perks',
          label: 'Perks from your workshop (one per line, 3–6)',
          type: 'textarea',
          required: true,
          maxLength: 500,
        },
      ],
      submit: 'Change prices',
      save: async (d) => {
        await api('/garage/membership', {
          method: 'PUT',
          body: {
            price: Number(d.price),
            hourly_rate: Number(d.hourly_rate),
            member_rate: Number(d.member_rate),
            perks: lines(d.perks).map((l) => l.trim()),
          },
        });
        await after('Membership updated');
      },
    });
  const offering = () =>
    open(
      info.offering
        ? {
            silent: true,
            title: 'Stop offering memberships?',
            note: 'Drivers can’t join any more. Your current members keep their benefits until their renewal date, then their membership ends and they aren’t charged again. We’ll tell them.',
            submit: 'Stop offering',
            save: async () => {
              await api('/garage/membership/offering', { method: 'PUT', body: { on: false } });
              await after(
                'Memberships are off. Current members keep their benefits until renewal.',
              );
            },
          }
        : {
            silent: true,
            title: 'Offer memberships again?',
            note: 'Drivers can join again and see your member hourly rate. Members whose membership was ending will renew as usual, and we’ll tell them.',
            submit: 'Turn memberships on',
            save: async () => {
              await api('/garage/membership/offering', { method: 'PUT', body: { on: true } });
              await after('Drivers can join your membership again.');
            },
          },
    );
  const count = (audience) =>
    new Set(
      live
        .filter(
          (m) => audience === 'all' || m.plan_kind === (audience === 'basic' ? 'basic' : 'garage'),
        )
        .map((m) => m.driver_id),
    ).size;
  const update = () =>
    open({
      silent: true,
      title: 'Send members an update',
      note: 'They get it in MotoDoc. It can’t be taken back.',
      values: {
        audience: 'all',
        message: `Hi! A quick update from ${data['garage/profile']?.name || 'your garage'}: `,
      },
      fields: [
        {
          name: 'audience',
          label: 'Who should get it?',
          required: true,
          options: UPDATE_AUDIENCES.map(([value, label]) => ({
            value,
            label: `${label} (${count(value)})`,
          })),
        },
        { name: 'message', label: 'Message', type: 'textarea', required: true, maxLength: 600 },
      ],
      submit: 'Send update',
      save: async (d) => {
        const r = await api('/garage/membership/updates', { method: 'POST', body: d });
        await after(`Update sent to ${r.recipients} ${r.recipients === 1 ? 'member' : 'members'}`);
      },
    });
  const custom = () =>
    open({
      silent: true,
      title: 'Ask for a custom plan',
      note: 'Tell the MotoDoc team what you’d like, for example a fleet or company plan.',
      fields: [
        {
          name: 'message',
          label: 'Your custom plan',
          type: 'textarea',
          required: true,
          maxLength: 1500,
        },
      ],
      submit: 'Send to MotoDoc',
      save: async (d) => {
        await api('/garage/membership/custom', { method: 'POST', body: d });
        await after('Sent to the MotoDoc team — we’ll be in touch within 2 working days.');
      },
    });

  return (
    <>
      <article className="dash-tile mem-live">
        <div>
          <span className="eyebrow">{`LIVE SINCE ${longDate(info.launched_at).toUpperCase()}`}</span>
          <h2>Your membership</h2>
        </div>
        <div className="mem-buttons">
          <button className="button button-small" onClick={editPlan}>
            Edit plan
          </button>
          {owner && (
            <button className="dash-text-button" onClick={custom}>
              Ask for a custom plan
            </button>
          )}
        </div>
      </article>
      <article className={`dash-tile mem-offering${info.offering ? ' on' : ''}`}>
        <div>
          <h3>Offer memberships to drivers</h3>
          <p>
            {info.offering
              ? 'On: drivers can join your membership and see your member hourly rate.'
              : 'Off: drivers can’t join and don’t see a member rate. Current members keep their benefits until their renewal date, then it ends.'}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={info.offering}
          className="mem-switch"
          onClick={offering}
          aria-label="Offer memberships to drivers"
        >
          <span />
        </button>
      </article>
      <div className="dash-stats mem-stats">
        {[
          ['Subscribers', info.stats.subscribers],
          ['Yearly price', euro(plan.price_cents)],
          [
            `You keep (${100 - (info.stats.share ?? 30)}%)`,
            euro(Math.round((plan.price_cents * (100 - (info.stats.share ?? 30))) / 100)),
          ],
          ['Yearly income', euro(info.stats.keep_cents)],
        ].map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <article className="dash-tile mem-plan-card">
        <span className="eyebrow">GARAGE MEMBERSHIP</span>
        <h3>Your plan</h3>
        <strong className="mem-plan-price">{`${euro(plan.price_cents)} / year · auto-renews`}</strong>
        <h4>Always included</h4>
        <Benefits items={[...BASIC_BENEFITS, ...FULL_EXTRAS]} />
        <h4>Plus from your workshop</h4>
        <Benefits items={[]} extra={lines(plan.benefits)} />
        <h4>Your hourly rates</h4>
        <p>
          {`Standard ${info.hourly_rate ? euro(info.hourly_rate * 100) : '—'}/h · Member ${info.member_rate ? euro(info.member_rate * 100) : '—'}/h`}
        </p>
      </article>
      <div className="dash-section-heading">
        <h2>Subscribers</h2>
        <button className="dash-secondary" onClick={update} disabled={!live.length}>
          <PaperPlaneTiltIcon size={16} /> Send members an update
        </button>
      </div>
      <p className="dash-help">
        {`${info.stats.subscribers} ${info.stats.subscribers === 1 ? 'member' : 'members'} · ${info.stats.on_plan} on your plan`}
        {info.last_update
          ? ` · Last update sent ${longDate(info.last_update.sent_at)} to ${info.last_update.recipients}`
          : ''}
      </p>
      {members.length ? (
        <div className="dash-list">
          {members.map((m) => (
            <article className="dash-row" key={m.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{m.driver_name}</h3>
                  <span className="mem-pill">
                    {m.plan_kind === 'basic' ? 'Basic' : 'Your plan'}
                  </span>
                  <Status>{m.state}</Status>
                </div>
                <p>{m.vehicles.map(carName).join(', ')}</p>
                <p>
                  {`Member since ${monthYear(m.member_since)} · ${m.billing === 'instalments' ? '3 instalments' : 'Yearly'} · ${euro(m.price_cents)}`}
                </p>
                <p>{garageNote(m)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="dash-help">No members yet — we’ll tell you the moment someone joins.</p>
      )}
    </>
  );
}
