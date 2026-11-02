import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  GasPumpIcon,
  GearSixIcon,
  HouseIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  PaintBrushIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
  StarIcon,
  StorefrontIcon,
  ChatTextIcon,
  CalendarBlankIcon,
  UsersIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Brand } from './Brand.jsx';
import { Status, ThemeToggle } from './DashParts.jsx';
import { DemoBar } from './Demo.jsx';
import { FormDialog } from './Dashboard.jsx';
import { flash, toast } from './Toasts.jsx';
import { ADMIN_SECTIONS } from './platform.js';
import './dashboard.css';
import './admin-console.css';

const ICONS = {
  overview: HouseIcon,
  users: UsersIcon,
  garages: StorefrontIcon,
  bookings: CalendarBlankIcon,
  marketplace: LifebuoyIcon,
  'fuel-day': GasPumpIcon,
  reviews: StarIcon,
  payments: ReceiptIcon,
  feedback: ChatTextIcon,
  announcements: MegaphoneIcon,
  settings: GearSixIcon,
  audit: ClockCounterClockwiseIcon,
  site: PaintBrushIcon,
};
const euro = (cents) =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const when = (iso) =>
  iso
    ? new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString('en-FI', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Helsinki',
      })
    : '';
const day = (iso) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('en-FI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const bookingState = (b) =>
  b.status === 'pending' ? 'awaiting approval' : b.status === 'confirmed' ? 'approved' : b.status;

function Tiles({ items }) {
  return (
    <div className="dash-stats ac-tiles">
      {items.map(([label, value]) => (
        <article key={label}>
          <p>{label}</p>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}
function Rows({ items, empty, render }) {
  if (!items.length) return <p className="dash-help ac-empty">{empty}</p>;
  return <div className="dash-list">{items.map(render)}</div>;
}

export function AdminConsole() {
  const [me, setMe] = useState(null),
    [denied, setDenied] = useState(''),
    [section, setSection] = useState(() => location.hash.slice(1) || 'overview'),
    [loaded, setData] = useState(null),
    [dialog, setDialog] = useState(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('');
  const key = ADMIN_SECTIONS.some(([k]) => k === section) ? section : 'overview';
  const title = ADMIN_SECTIONS.find(([k]) => k === key)[1];

  useEffect(() => {
    api('/auth/me')
      .then(({ user }) => (user.admin ? setMe(user) : setDenied(user.email)))
      .catch((e) => {
        if (e.status === 401) location.replace('/login');
        else toast(e.message, 'error');
      });
    const changed = () => {
      setSection(location.hash.slice(1) || 'overview');
      setQuery('');
      setFilter('');
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    document.title = `${title} — MotoDoc admin`;
  }, [title]);

  const load = useCallback(async () => {
    if (!me) return;
    if (key === 'site') return location.assign('/admin/site');
    if (key === 'fuel-day') return setData({ key, value: {} });
    const path = key === 'users' ? `/admin/users?q=${encodeURIComponent(query)}` : `/admin/${key}`;
    try {
      const value = await api(path);
      setData({ key, value });
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [me, key, query]);
  useEffect(() => {
    setData(null);
  }, [key]);
  useEffect(() => {
    const timer = setTimeout(load, key === 'users' ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, key]);

  const open = (config) => setDialog(config);
  const act = async (path, body, message) => {
    try {
      await api(path, { method: 'POST', body: body || {} });
      toast(message);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
    flash('You have been signed out.');
    location.assign('/login');
  };

  if (denied)
    return (
      <main className="admin-denied">
        <Brand />
        <h1>Administrators only</h1>
        <p>{`${denied} is not a MotoDoc administrator.`}</p>
        <a href="/app">Back to your account</a>
      </main>
    );
  if (!me)
    return (
      <main className="admin-denied" aria-busy="true">
        <Brand />
        <p>Loading…</p>
      </main>
    );

  const body = () => {
    if (!loaded || loaded.key !== key) return <p className="dash-help">Loading…</p>;
    const data = loaded.value;
    if (key === 'overview') {
      const t = data.tiles;
      return (
        <>
          <Tiles
            items={[
              ['Drivers', t.drivers],
              ['Garages verified', `${t.verified} / ${t.garages}`],
              ['Bookings', t.bookings],
              ['Open marketplace jobs', t.open_market],
              ['Invoiced', euro(t.invoiced)],
              ['Paid', euro(t.paid)],
              ['Overdue invoices', t.overdue],
              ['Reviews', t.reviews],
            ]}
          />
          <div className="dash-section-heading">
            <h2>Needs attention</h2>
          </div>
          <div className="dash-list">
            {data.attention.map((a) => (
              <a
                className={`dash-row ac-attention${a.count ? ' warn' : ''}`}
                href={`#${a.section}`}
                key={a.label}
              >
                {a.count ? <WarningIcon size={20} /> : <ShieldCheckIcon size={20} />}
                <span>{a.count ? `${a.count} ${a.label}` : `No ${a.plural}`}</span>
                <ArrowRightIcon size={16} />
              </a>
            ))}
          </div>
          <div className="dash-section-heading">
            <h2>Recent admin activity</h2>
          </div>
          <Rows
            items={data.activity}
            empty="No admin actions yet."
            render={(a) => (
              <article className="dash-row" key={a.id}>
                <div className="dash-row-body">
                  <h3>{a.action}</h3>
                  <p>{[a.target, a.detail].filter(Boolean).join(' · ')}</p>
                  <p>{`${when(a.at)} · ${a.admin_name}`}</p>
                </div>
              </article>
            )}
          />
        </>
      );
    }
    if (key === 'users') {
      const list = data.filter(
        (u) => !filter || u.kind === filter || (filter === 'admin' && u.admin),
      );
      return (
        <>
          <div className="ac-filters">
            <label className="dash-search">
              Search users
              <input
                type="search"
                placeholder="Name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="dash-field ac-select">
              Role
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Everyone</option>
                <option value="driver">Drivers</option>
                <option value="garage">Garage owners</option>
                <option value="team">Garage team</option>
                <option value="admin">Administrators</option>
              </select>
            </label>
          </div>
          <Rows
            items={list}
            empty="No users match."
            render={(u) => (
              <article className="dash-row" key={u.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{u.name}</h3>
                    <span className="mem-pill">
                      {u.admin
                        ? 'Admin'
                        : u.kind === 'team'
                          ? 'Garage team'
                          : u.kind === 'garage'
                            ? 'Garage'
                            : 'Driver'}
                    </span>
                    <Status>{u.suspended_at ? 'suspended' : 'active'}</Status>
                  </div>
                  <p>{u.email}</p>
                  <p>
                    {`Joined ${day(u.created_at.includes('T') ? u.created_at : `${u.created_at.replace(' ', 'T')}Z`)}`}
                    {u.suspended_reason ? ` · ${u.suspended_reason}` : ''}
                  </p>
                </div>
                {!u.admin && u.id !== me.id && (
                  <div className="ac-buttons">
                    {u.suspended_at ? (
                      <button
                        className="dash-text-button"
                        onClick={() =>
                          act(`/admin/users/${u.id}/reactivate`, {}, `${u.name} can sign in again`)
                        }
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        className="dash-text-button muted"
                        onClick={() =>
                          open({
                            title: `Suspend ${u.name}?`,
                            note: 'They’re signed out straight away and can’t sign in until you reactivate them.',
                            fields: [
                              {
                                name: 'reason',
                                label: 'Reason (kept in the audit log)',
                                required: true,
                                maxLength: 300,
                              },
                            ],
                            submit: 'Suspend account',
                            save: async (d) => {
                              await api(`/admin/users/${u.id}/suspend`, {
                                method: 'POST',
                                body: d,
                              });
                              toast(`${u.name} is suspended`);
                            },
                          })
                        }
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                )}
              </article>
            )}
          />
        </>
      );
    }
    if (key === 'garages')
      return (
        <>
          <Rows
            items={data.garages}
            empty="No garages yet."
            render={(g) => (
              <article className="dash-row" key={g.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{g.name}</h3>
                    <Status>{g.verification}</Status>
                    {!g.published && <span className="mem-pill">Not published</span>}
                  </div>
                  <p>{[g.address, g.city].filter(Boolean).join(', ')}</p>
                  <p>
                    {`${g.owner_name} · ${g.owner_email}${g.business_id ? ` · Y-tunnus ${g.business_id}` : ' · No Y-tunnus'}`}
                  </p>
                  <p>
                    {g.review_count ? `★ ${g.rating} (${g.review_count})` : 'No reviews yet'}
                    {g.verification_note ? ` · ${g.verification_note}` : ''}
                  </p>
                </div>
                <div className="ac-buttons">
                  {g.verification !== 'verified' && (
                    <button
                      className="button button-small"
                      onClick={() =>
                        act(`/admin/garages/${g.id}/verify`, {}, `${g.name} is verified`)
                      }
                    >
                      Verify
                    </button>
                  )}
                  {g.verification !== 'rejected' && (
                    <button
                      className="dash-text-button muted"
                      onClick={() =>
                        open({
                          title: `Reject ${g.name}?`,
                          note: 'Drivers can’t find or book this garage until it’s verified. The owner is told why.',
                          fields: [
                            { name: 'reason', label: 'Reason', required: true, maxLength: 300 },
                          ],
                          submit: 'Reject garage',
                          save: async (d) => {
                            await api(`/admin/garages/${g.id}/reject`, {
                              method: 'POST',
                              body: d,
                            });
                            toast(`${g.name} was rejected`);
                          },
                        })
                      }
                    >
                      Reject
                    </button>
                  )}
                </div>
              </article>
            )}
          />
          <div className="dash-section-heading">
            <h2>Custom plan requests</h2>
          </div>
          <Rows
            items={data.requests}
            empty="No custom plan requests."
            render={(r) => (
              <article className="dash-row" key={r.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{r.garage_name}</h3>
                    <Status>{r.status === 'new' ? 'pending' : 'done'}</Status>
                  </div>
                  <p>{r.message}</p>
                  <p>{when(r.created_at)}</p>
                </div>
                {r.status === 'new' && (
                  <div className="ac-buttons">
                    <button
                      className="dash-text-button"
                      onClick={() =>
                        act(`/admin/custom-requests/${r.id}/done`, {}, 'Marked as handled')
                      }
                    >
                      Mark handled
                    </button>
                  </div>
                )}
              </article>
            )}
          />
        </>
      );
    if (key === 'bookings')
      return (
        <Rows
          items={data}
          empty="No bookings yet."
          render={(b) => (
            <article className="dash-row" key={b.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{b.service}</h3>
                  {b.source === 'marketplace' && <span className="mem-pill">Marketplace</span>}
                  <Status>{bookingState(b)}</Status>
                </div>
                <p>{`${b.driver_name} · ${b.garage_name}`}</p>
                <p>{when(b.starts_at)}</p>
              </div>
            </article>
          )}
        />
      );
    if (key === 'marketplace')
      return (
        <Rows
          items={data}
          empty="No marketplace requests yet."
          render={(r) => (
            <article className="dash-row" key={r.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{r.service}</h3>
                  <Status>
                    {r.status === 'open' && !r.quotes
                      ? 'no quotes yet'
                      : r.status === 'booked'
                        ? 'booked'
                        : r.status}
                  </Status>
                </div>
                <p>{`${r.driver_name} · ${r.area} · ${when(r.created_at)}`}</p>
                <p>
                  {r.quotes
                    ? `${r.quotes} ${r.quotes === 1 ? 'quote' : 'quotes'} · ${euro(r.min_cents)}${r.max_cents !== r.min_cents ? `–${euro(r.max_cents)}` : ''}`
                    : 'No quotes'}
                </p>
              </div>
            </article>
          )}
        />
      );
    if (key === 'fuel-day')
      return (
        <div className="dash-empty">
          <GasPumpIcon size={30} />
          <p>Fuel Day setup, pass checks and the results funnel arrive in the next stage.</p>
        </div>
      );
    if (key === 'reviews')
      return (
        <Rows
          items={data}
          empty="No reviews yet."
          render={(r) => (
            <article className={`dash-row${r.hidden ? ' ac-hidden' : ''}`} key={r.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{`${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.garage_name}`}</h3>
                  {r.hidden ? <span className="mem-pill">Hidden</span> : null}
                </div>
                {r.comment && <p>{`“${r.comment}”`}</p>}
                <p>{`${r.author} · ${when(r.created_at)}`}</p>
              </div>
              <div className="ac-buttons">
                <button
                  className={r.hidden ? 'dash-text-button' : 'dash-text-button muted'}
                  onClick={() =>
                    act(
                      `/admin/reviews/${r.id}/visibility`,
                      { hidden: !r.hidden },
                      r.hidden
                        ? 'Review is visible again'
                        : 'Review hidden. It no longer counts toward the rating.',
                    )
                  }
                >
                  {r.hidden ? 'Show' : 'Hide'}
                </button>
              </div>
            </article>
          )}
        />
      );
    if (key === 'payments')
      return (
        <>
          <Tiles
            items={[
              ['Invoiced', euro(data.tiles.invoiced)],
              ['Paid', euro(data.tiles.paid)],
              ['Outstanding', euro(data.tiles.outstanding)],
              ['Overdue', euro(data.tiles.overdue)],
            ]}
          />
          <Rows
            items={data.invoices}
            empty="No invoices yet."
            render={(i) => (
              <article className="dash-row" key={i.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{`${i.number || 'Invoice'} · ${euro(i.amount_cents)}`}</h3>
                    <Status>{i.state}</Status>
                  </div>
                  <p>{`${i.garage_name} → ${i.driver_name}`}</p>
                  <p>{`Due ${day(i.due_date)}`}</p>
                </div>
              </article>
            )}
          />
        </>
      );
    if (key === 'feedback') {
      const list = data.filter((f) => filter === 'all' || f.status === 'new');
      return (
        <>
          <div className="mk-tabs md-scroll-x" role="tablist">
            {[
              ['', 'To check'],
              ['all', 'All'],
            ].map(([value, label]) => (
              <button
                key={label}
                role="tab"
                aria-selected={filter === value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <Rows
            items={list}
            empty="Nothing to check. New feedback appears here."
            render={(f) => (
              <article className="dash-row" key={f.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{f.kind === 'problem' ? 'Problem' : 'Idea'}</h3>
                    <Status>{f.status === 'new' ? 'pending' : 'done'}</Status>
                  </div>
                  <p>{f.message}</p>
                  <p>
                    {`${f.user_name || 'Deleted user'}${f.user_email ? ` · ${f.user_email}` : ''} · ${when(f.created_at)}${f.page ? ` · ${f.page}` : ''}`}
                  </p>
                </div>
                {f.status === 'new' && (
                  <div className="ac-buttons">
                    <button
                      className="dash-text-button"
                      onClick={() =>
                        act(`/admin/feedback/${f.id}/checked`, {}, 'Marked as checked')
                      }
                    >
                      Mark checked
                    </button>
                  </div>
                )}
              </article>
            )}
          />
        </>
      );
    }
    if (key === 'announcements')
      return (
        <>
          <article className="dash-tile ac-announce">
            <div>
              <h2>Send an announcement</h2>
              <p>It appears in everyone’s MotoDoc notifications.</p>
            </div>
            <button
              className="button button-small"
              onClick={() =>
                open({
                  title: 'Send an announcement',
                  note: 'It goes out straight away and can’t be taken back.',
                  values: { audience: 'everyone' },
                  fields: [
                    {
                      name: 'audience',
                      label: 'Send to',
                      required: true,
                      options: [
                        { value: 'everyone', label: 'Everyone' },
                        { value: 'drivers', label: 'Drivers' },
                        { value: 'garages', label: 'Garages' },
                      ],
                    },
                    { name: 'title', label: 'Title', required: true, maxLength: 80 },
                    {
                      name: 'message',
                      label: 'Message',
                      type: 'textarea',
                      required: true,
                      maxLength: 1000,
                    },
                  ],
                  submit: 'Send',
                  save: async (d) => {
                    const r = await api('/admin/announcements', { method: 'POST', body: d });
                    toast(`Sent to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}`);
                  },
                })
              }
            >
              <MegaphoneIcon size={16} /> New announcement
            </button>
          </article>
          <div className="dash-section-heading">
            <h2>Sent</h2>
          </div>
          <Rows
            items={data}
            empty="No announcements sent yet."
            render={(a) => (
              <article className="dash-row" key={a.id}>
                <div className="dash-row-body">
                  <div className="dash-row-title">
                    <h3>{a.title}</h3>
                    <span className="mem-pill">
                      {a.audience === 'everyone'
                        ? 'Everyone'
                        : a.audience === 'drivers'
                          ? 'Drivers'
                          : 'Garages'}
                    </span>
                  </div>
                  <p>{a.message}</p>
                  <p>{`${when(a.sent_at)} · ${a.recipients} people · ${a.sent_by}`}</p>
                </div>
              </article>
            )}
          />
        </>
      );
    if (key === 'settings') return <Settings data={data} me={me} onSaved={load} />;
    if (key === 'audit')
      return (
        <Rows
          items={data}
          empty="No admin actions yet."
          render={(a) => (
            <article className="dash-row" key={a.id}>
              <div className="dash-row-body">
                <h3>{a.action}</h3>
                {(a.target || a.detail) && (
                  <p>{[a.target, a.detail].filter(Boolean).join(' · ')}</p>
                )}
                <p>{`${when(a.at)} · ${a.admin_name}`}</p>
              </div>
            </article>
          )}
        />
      );
    return null;
  };

  return (
    <div className="dashboard ac">
      <aside className="dash-sidebar" data-fit>
        <Brand />
        <span className="dash-role">ADMIN</span>
        <nav aria-label="Admin sections">
          {ADMIN_SECTIONS.map(([k, label]) => {
            const Icon = ICONS[k];
            return (
              <a
                key={k}
                href={k === 'site' ? '/admin/site' : `#${k}`}
                className={key === k ? 'active' : ''}
                aria-current={key === k ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="dash-account">
          <span data-lang-switch />
          <span className="ac-email">{me.email}</span>
          <ThemeToggle />
          <button className="icon-button" aria-label="Log out" onClick={logout}>
            <SignOutIcon size={20} />
          </button>
        </div>
      </aside>
      <main className="dash-main" key={key}>
        {me.demo && <DemoBar persona={me.demo} />}
        <header className="dash-page-header">
          <div>
            <span className="eyebrow">MOTODOC ADMIN</span>
            <h1>{title}</h1>
            <p>
              {me.demo
                ? 'You’re looking at this demo’s sample data only.'
                : 'Everything across MotoDoc, in one place.'}
            </p>
          </div>
        </header>
        {body()}
      </main>
      {dialog && (
        <FormDialog
          config={dialog}
          onClose={() => setDialog(null)}
          onSave={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

function Settings({ data, me, onSaved }) {
  const [form, setForm] = useState(data),
    [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k, label, hint, step = 1) => (
    <label className="dash-field" key={k}>
      {label}
      <input
        type="number"
        step={step}
        min={0}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
      />
      {hint && <small className="dash-help">{hint}</small>}
    </label>
  );
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === 'boolean' ? v : Number(v)]),
      );
      const r = await api('/admin/settings', { method: 'PUT', body });
      toast(r.changed ? 'Saved' : 'Nothing changed');
      await onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="dash-tile ac-settings" onSubmit={save}>
      <label className="ac-switch">
        <input
          type="checkbox"
          checked={form.launch_bonus}
          onChange={(e) => set('launch_bonus', e.target.checked)}
        />
        <span>
          <strong>Launch bonus: Pro for free</strong>
          <small>When off, new accounts start on the Free plan.</small>
        </span>
      </label>
      {num('pro_price_garage', 'Pro price for garages (€ / month)')}
      {num('pro_price_driver', 'Pro price for drivers (€ / month)', '', 0.01)}
      {num('motodoc_share', 'MotoDoc share of garage memberships (%)')}
      {num('vat_rate', 'VAT rate (%)', 'General Finnish rate since 1 September 2024.', 0.1)}
      {num('reply_garage_hours', 'Reply reminder for garages (hours)')}
      {num('reply_driver_hours', 'Reply reminder for drivers (hours)')}
      <div className="dash-form-actions">
        <button className="button button-small" disabled={busy || !!me.demo}>
          {me.demo ? 'Read-only in the demo' : busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      {me.demo && (
        <p className="dash-help">
          <CheckCircleIcon size={14} /> Platform settings affect the live site, so the demo admin
          can look but not change them.
        </p>
      )}
    </form>
  );
}
