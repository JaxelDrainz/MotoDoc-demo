import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CarIcon,
  ImageIcon,
  LifebuoyIcon,
  MapPinIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import { COMMON_SERVICES } from './finland.js';
import { MARKET_DURATIONS, URGENCY, durationLabel } from './marketplace.js';
import './marketplace.css';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const when = (iso) =>
  new Date(iso).toLocaleString('en-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const dayText = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const ago = (iso) => {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 60) return `Posted ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Posted ${hours} h ago`;
  return `Posted ${Math.round(hours / 24)} d ago`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const urgencyName = (key) => URGENCY.find(([k]) => k === key)?.[1] || key;
const localDate = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let data = canvas.toDataURL('image/jpeg', 0.8);
  if (data.length > 1000000) data = canvas.toDataURL('image/jpeg', 0.55);
  return data;
}

function Photos({ urls }) {
  if (!urls?.length) return null;
  return (
    <div className="mk-photos">
      {urls.map((url) => (
        <a href={url} target="_blank" rel="noreferrer" key={url}>
          <img src={url} alt="Photo from the driver" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function RequestFacts({ r, customer }) {
  return (
    <ul className="mk-facts">
      {customer && <li>{r.driver_name}</li>}
      <li>
        <CarIcon size={15} />
        {`${r.make} ${r.model} · ${r.registration}${r.mileage ? ` · ${r.mileage.toLocaleString('en-FI')} km` : ''}`}
      </li>
      <li>{`Preferred ${dayText(r.preferred_date)}`}</li>
      <li>
        <MapPinIcon size={15} />
        {r.area}
      </li>
    </ul>
  );
}

function Wizard({ vehicles, user, onClose, onDone }) {
  const ref = useRef(null);
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [form, setForm] = useState({
    choice: '',
    custom: '',
    vehicle_id: vehicles.length === 1 ? vehicles[0].id : '',
    urgency: 'week',
    preferred_date: localDate(2),
    area: (user.address || '').split(',').pop().trim(),
    description: '',
    mileage: vehicles.length === 1 ? String(vehicles[0].mileage || '') : '',
    photos: [],
  });
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };
  const service =
    form.choice === 'diagnosis'
      ? 'I don’t know the issue'
      : form.choice === 'custom'
        ? form.custom.trim()
        : form.choice;
  const car = vehicles.find((v) => v.id === form.vehicle_id);
  const steps = ['What’s wrong', 'Your car', 'When and where', 'Details', 'Check and post'];
  const problem = [
    () =>
      !form.choice
        ? 'Choose what you need help with.'
        : form.choice === 'custom' && !form.custom.trim()
          ? 'Say in a few words what you need.'
          : '',
    () => (!form.vehicle_id ? 'Choose the car that needs help.' : ''),
    () =>
      form.preferred_date < localDate()
        ? 'Choose today or a later date.'
        : !form.area.trim()
          ? 'Add your city or postcode so nearby garages see it.'
          : '',
    () => (!form.description.trim() ? 'Describe what’s wrong so garages can quote.' : ''),
    () => '',
  ];
  const next = () => {
    const p = problem[step]();
    if (p) return setError(p);
    setStep(step + 1);
  };
  const addPhotos = async (files) => {
    const room = 4 - form.photos.length;
    const picked = [...files].slice(0, room);
    if (files.length > room) toast('You can add up to 4 photos.', 'error');
    try {
      const shrunk = await Promise.all(picked.map(shrink));
      set({ photos: [...form.photos, ...shrunk] });
    } catch {
      toast('That photo couldn’t be read. Try a JPEG or PNG.', 'error');
    }
  };
  const post = async () => {
    setBusy(true);
    setError('');
    try {
      const { id, garages } = await api('/market/requests', {
        method: 'POST',
        body: {
          vehicle_id: form.vehicle_id,
          service,
          kind: ['diagnosis', 'custom'].includes(form.choice) ? form.choice : 'service',
          urgency: form.urgency,
          preferred_date: form.preferred_date,
          area: form.area.trim(),
          description: form.description.trim(),
          ...(form.mileage ? { mileage: Number(form.mileage) } : {}),
        },
      });
      for (const data of form.photos)
        await api(`/market/requests/${id}/photos`, { method: 'POST', body: { data } }).catch((e) =>
          toast(e.message, 'error'),
        );
      toast(
        garages
          ? 'Request sent. Nearby garages can now reply.'
          : 'Request sent. No garages near you are on MotoDoc yet, so offers may take a while.',
      );
      await onDone();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className="dash-dialog mk-wizard"
      aria-labelledby="mk-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
      >
        <XIcon size={21} />
      </button>
      <span className="eyebrow">{`STEP ${step + 1} OF ${steps.length}`}</span>
      <h2 id="mk-title">{steps[step]}</h2>
      <div className="mk-progress" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className={i <= step ? 'done' : ''} />
        ))}
      </div>
      {step === 0 && (
        <fieldset className="dash-field dash-checks mk-choices">
          <legend>What do you need help with?</legend>
          {[...COMMON_SERVICES.slice(0, 10), 'diagnosis', 'custom'].map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="choice"
                checked={form.choice === value}
                onChange={() => set({ choice: value })}
              />
              {value === 'diagnosis'
                ? 'I don’t know the issue'
                : value === 'custom'
                  ? 'Custom request'
                  : value}
            </label>
          ))}
          {form.choice === 'custom' && (
            <input
              className="mk-custom"
              aria-label="What do you need?"
              placeholder="What do you need?"
              maxLength={80}
              value={form.custom}
              onChange={(e) => set({ custom: e.target.value })}
            />
          )}
        </fieldset>
      )}
      {step === 1 &&
        (vehicles.length ? (
          <fieldset className="dash-field dash-checks mk-choices">
            <legend>Which car needs help?</legend>
            {vehicles.map((v) => (
              <label key={v.id}>
                <input
                  type="radio"
                  name="vehicle"
                  checked={form.vehicle_id === v.id}
                  onChange={() => set({ vehicle_id: v.id, mileage: String(v.mileage || '') })}
                />
                {`${v.make} ${v.model} · ${v.registration}`}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="dash-help">Add your car first, under My vehicles.</p>
        ))}
      {step === 2 && (
        <>
          <fieldset className="dash-field mk-urgency">
            <legend>How soon?</legend>
            {URGENCY.map(([value, label, hint]) => (
              <label key={value} className={form.urgency === value ? 'selected' : ''}>
                <input
                  type="radio"
                  name="urgency"
                  checked={form.urgency === value}
                  onChange={() => set({ urgency: value })}
                />
                <strong>{label}</strong>
                <small>{hint}</small>
              </label>
            ))}
          </fieldset>
          <label className="dash-field">
            Preferred date
            <input
              type="date"
              min={localDate()}
              value={form.preferred_date}
              onChange={(e) => set({ preferred_date: e.target.value })}
            />
          </label>
          <label className="dash-field">
            Area (city or postcode)
            <input
              maxLength={80}
              placeholder="e.g. Helsinki or 00100"
              value={form.area}
              onChange={(e) => set({ area: e.target.value })}
            />
          </label>
        </>
      )}
      {step === 3 && (
        <>
          <label className="dash-field">
            What’s happening?
            <textarea
              rows={4}
              maxLength={2000}
              placeholder="e.g. The brakes squeak when I slow down."
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <label className="dash-field">
            Current mileage (km)
            <input
              type="number"
              min={0}
              value={form.mileage}
              onChange={(e) => set({ mileage: e.target.value })}
            />
          </label>
          <div className="dash-field">
            Photos (up to 4)
            <div className="mk-photo-edit">
              {form.photos.map((src, i) => (
                <span key={i}>
                  <img src={src} alt={`Photo ${i + 1}`} />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => set({ photos: form.photos.filter((_, j) => j !== i) })}
                  >
                    <TrashIcon size={14} />
                  </button>
                </span>
              ))}
              {form.photos.length < 4 && (
                <label className="mk-add-photo">
                  <ImageIcon size={22} />
                  <span>Add</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </>
      )}
      {step === 4 && (
        <dl className="mk-summary">
          <dt>Help with</dt>
          <dd>{service}</dd>
          <dt>Car</dt>
          <dd>{car ? `${car.make} ${car.model} · ${car.registration}` : ''}</dd>
          <dt>How soon</dt>
          <dd>{`${urgencyName(form.urgency)} · from ${dayText(form.preferred_date)}`}</dd>
          <dt>Area</dt>
          <dd>{form.area}</dd>
          <dt>Details</dt>
          <dd>{form.description}</dd>
          {form.photos.length > 0 && (
            <>
              <dt>Photos</dt>
              <dd>{plural(form.photos.length, 'photo', 'photos')}</dd>
            </>
          )}
        </dl>
      )}
      {error && (
        <p role="alert" className="dash-error">
          {error}
        </p>
      )}
      <div className="dash-form-actions">
        {step > 0 && (
          <button
            type="button"
            className="dash-secondary"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button type="button" className="button button-small" onClick={next}>
            Continue
          </button>
        ) : (
          <button type="button" className="button button-small" disabled={busy} onClick={post}>
            {busy ? 'Posting…' : 'Post request'}
          </button>
        )}
      </div>
    </dialog>
  );
}

export function DriverMarketplace({ data, user, open, reload }) {
  const [requests, setRequests] = useState(null),
    [tab, setTab] = useState('open'),
    [wizard, setWizard] = useState(false);
  const load = useCallback(
    () =>
      api('/market/requests')
        .then(setRequests)
        .catch((e) => toast(e.message, 'error')),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!requests) return <p className="dash-help">Loading your requests…</p>;
  const groups = {
    open: requests.filter((r) => r.status === 'open' || (r.status === 'closed' && r.quotes.length)),
    booked: requests.filter((r) => r.status === 'booked'),
    closed: requests.filter((r) => r.status === 'closed' && !r.quotes.length),
  };
  const waiting = groups.open.reduce((n, r) => n + r.quotes.length, 0);
  const view = (q, r) =>
    open({
      silent: true,
      title: `${euro(q.price_cents)} from ${q.garage_name}`,
      content: (
        <dl className="mk-summary">
          <dt>Total price</dt>
          <dd>{`${euro(q.price_cents)} incl. VAT`}</dd>
          <dt>Appointment</dt>
          <dd>{when(q.starts_at)}</dd>
          <dt>Takes about</dt>
          <dd>{durationLabel(q.minutes)}</dd>
          <dt>Sent</dt>
          <dd>{when(q.created_at)}</dd>
          <dt>Garage</dt>
          <dd>{[q.garage_address, q.garage_phone].filter(Boolean).join(' · ')}</dd>
          {q.notes && (
            <>
              <dt>What’s included</dt>
              <dd>{q.notes}</dd>
            </>
          )}
          <dt>Rating</dt>
          <dd>{q.review_count ? `${q.rating} / 5 (${q.review_count})` : 'No reviews yet'}</dd>
          {q.hourly_rate_cents && (
            <>
              <dt>Hourly rate</dt>
              <dd>
                {`${euro(q.hourly_rate_cents)}/h${q.member_rate_cents ? ` · Member ${euro(q.member_rate_cents)}/h` : ''}`}
              </dd>
            </>
          )}
        </dl>
      ),
      submit: 'Accept & book',
      save: () => accept(q, r),
    });
  const accept = async (q) => {
    await api(`/market/quotes/${q.id}/accept`, { method: 'POST', body: {} });
    toast('Offer accepted. Your appointment is booked.');
    await load();
  };
  const confirmAccept = (q, r) =>
    open({
      silent: true,
      title: 'Accept this offer?',
      note: `${q.garage_name} · ${euro(q.price_cents)} · ${when(q.starts_at)}. It’s booked straight away and other offers are turned down.`,
      submit: 'Accept & book',
      save: () => accept(q, r),
    });
  const close = (r) =>
    open({
      silent: true,
      title: 'Close this request?',
      note: r.quotes.length
        ? 'Garages can’t send new offers, but you can still accept one you already have.'
        : 'Garages won’t be able to send you offers for it.',
      submit: 'Close request',
      save: async () => {
        await api(`/market/requests/${r.id}/close`, { method: 'POST', body: {} });
        toast(
          r.quotes.length
            ? 'Request closed. No new offers, but you can still accept the ones you have.'
            : 'Request closed.',
        );
        await load();
      },
    });
  const list = groups[tab];
  return (
    <>
      <article className="dash-tile mk-intro">
        <LifebuoyIcon size={28} />
        <div>
          <h2>Get help fast</h2>
          <p>
            Tell us what’s wrong. Nearby garages reply with when they can help and what it costs,
            and you choose.
          </p>
        </div>
        <button className="button button-small" onClick={() => setWizard(true)}>
          Request help <PlusIcon size={16} />
        </button>
      </article>
      <div className="mk-tabs md-scroll-x" role="tablist">
        {[
          ['open', 'Open', waiting],
          ['booked', 'Booked', groups.booked.length],
          ['closed', 'Closed', groups.closed.length],
        ].map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
            {count > 0 && <span className="mk-count">{count}</span>}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="mk-list">
          {list.map((r) => (
            <article className="dash-tile mk-request" key={r.id}>
              <header>
                <div>
                  <h3>{r.service}</h3>
                  <small>{ago(r.created_at)}</small>
                </div>
                <div className="mk-pills">
                  <span className={`mk-pill urgency-${r.urgency}`}>{urgencyName(r.urgency)}</span>
                  {r.kind === 'custom' && <span className="mk-pill">Custom request</span>}
                  <span className="mk-pill strong">
                    {r.status === 'booked'
                      ? 'Booked'
                      : r.status === 'closed'
                        ? 'Closed'
                        : plural(r.quotes.length, 'offer', 'offers')}
                  </span>
                </div>
              </header>
              <RequestFacts r={r} />
              <p className="mk-description">{r.description}</p>
              <Photos urls={r.photos} />
              {r.status === 'closed' && r.quotes.length > 0 && (
                <p className="mk-note">
                  Closed to new offers. You can still accept one you received.
                </p>
              )}
              {r.quotes.length > 0 && (
                <ol className="mk-offers">
                  {r.quotes.map((q, i) => (
                    <li key={q.id} className={q.status === 'accepted' ? 'accepted' : ''}>
                      <div>
                        <strong>{q.garage_name}</strong>
                        {i === 0 && r.status !== 'booked' && (
                          <span className="mk-pill">Soonest</span>
                        )}
                        {q.status === 'accepted' && (
                          <span className="mk-pill strong">Accepted</span>
                        )}
                        <small>
                          <StarIcon size={12} weight="fill" />
                          {q.review_count ? ` ${q.rating} (${q.review_count})` : ' New'}
                        </small>
                      </div>
                      <p>
                        <strong>{euro(q.price_cents)}</strong>
                        {` · ${when(q.starts_at)} · takes about ${durationLabel(q.minutes)}`}
                      </p>
                      {q.notes && <p className="mk-quote-notes">{q.notes}</p>}
                      {r.status !== 'booked' && (
                        <div className="mk-buttons">
                          <button className="dash-text-button" onClick={() => view(q, r)}>
                            View
                          </button>
                          <button
                            className="button button-small"
                            onClick={() => confirmAccept(q, r)}
                          >
                            Accept & book
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {r.status === 'open' && !r.quotes.length && (
                <p className="dash-help">Waiting for offers from nearby garages.</p>
              )}
              {r.status === 'booked' && (
                <a className="dash-text-button" href="#bookings">
                  See your booking
                </a>
              )}
              {r.status === 'open' && (
                <button className="dash-text-button muted mk-close" onClick={() => close(r)}>
                  Close request
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="dash-empty">
          <p>
            {tab === 'open'
              ? 'No open requests. When your car needs help, post a request and nearby garages send offers.'
              : tab === 'booked'
                ? 'Offers you accept show up here.'
                : 'Closed requests show up here.'}
          </p>
        </div>
      )}
      {wizard && (
        <Wizard
          vehicles={data.vehicles}
          user={user}
          onClose={() => setWizard(false)}
          onDone={async () => {
            await load();
            setTab('open');
            await reload();
          }}
        />
      )}
    </>
  );
}

export function GarageMarketplace({ open, data }) {
  const [rows, setRows] = useState(null),
    [tab, setTab] = useState('to_quote');
  const load = useCallback(
    () =>
      api('/market/garage')
        .then(setRows)
        .catch((e) => toast(e.message, 'error')),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <p className="dash-help">Loading requests…</p>;
  const rate = data['garage/profile']?.hourly_rate;
  const quote = (r) => {
    const start = new Date(`${r.preferred_date}T09:00`);
    if (start.getTime() < Date.now()) {
      start.setTime(Date.now() + 86400000);
      start.setHours(9, 0, 0, 0);
    }
    const pad = (n) => String(n).padStart(2, '0');
    open({
      silent: true,
      title: `Send a quote: ${r.service}`,
      note: `${rate ? `Your hourly rate is €${rate}. ` : ''}If the driver accepts, this slot is booked and approved automatically.`,
      values: {
        price: '',
        minutes: '120',
        starts_at: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:00`,
        notes: '',
      },
      fields: [
        {
          name: 'price',
          label: 'Total price (€, incl. VAT)',
          type: 'number',
          min: 1,
          step: 0.5,
          required: true,
        },
        {
          name: 'minutes',
          label: 'Job takes about',
          required: true,
          options: MARKET_DURATIONS.map(([value, label]) => ({ value: String(value), label })),
        },
        {
          name: 'starts_at',
          label: 'Appointment you can offer',
          type: 'datetime-local',
          required: true,
        },
        { name: 'notes', label: 'What’s included (optional)', type: 'textarea', maxLength: 500 },
      ],
      submit: 'Send quote',
      save: async (d) => {
        if (!d.starts_at) throw new Error('Choose an appointment time.');
        await api(`/market/requests/${r.id}/quotes`, {
          method: 'POST',
          body: {
            price: Number(d.price),
            minutes: Number(d.minutes),
            starts_at: new Date(d.starts_at).toISOString(),
            notes: d.notes,
          },
        });
        toast('Quote sent. You’ll be notified if the driver accepts.');
        await load();
      },
    });
  };
  const tabs = [
    ['to_quote', 'To quote'],
    ['sent', 'Quote sent'],
    ['won', 'Won'],
    ['lost', 'Not selected'],
  ];
  const list = rows.filter((r) => r.tab === tab);
  return (
    <>
      <p className="dash-help">
        Drivers near you ask for help here. Send one quote with your price and a time you can offer;
        if they accept, it’s booked straight away.
      </p>
      <div className="mk-tabs md-scroll-x" role="tablist">
        {tabs.map(([key, label]) => {
          const count = rows.filter((r) => r.tab === key).length;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
              {count > 0 && <span className="mk-count">{count}</span>}
            </button>
          );
        })}
      </div>
      {list.length ? (
        <div className="mk-list">
          {list.map((r) => (
            <article className="dash-tile mk-request" key={r.id}>
              <header>
                <div>
                  <h3>{r.service}</h3>
                  <small>{ago(r.created_at)}</small>
                </div>
                <div className="mk-pills">
                  <span className={`mk-pill urgency-${r.urgency}`}>{urgencyName(r.urgency)}</span>
                  {r.kind === 'custom' && <span className="mk-pill">Custom request</span>}
                  <span className="mk-pill strong">
                    {r.tab === 'won'
                      ? 'Won'
                      : r.tab === 'lost'
                        ? 'Not selected'
                        : `${plural(r.quote_count, 'quote', 'quotes')} so far`}
                  </span>
                </div>
              </header>
              <RequestFacts r={r} customer />
              <p className="mk-description">{r.description}</p>
              <Photos urls={r.photos} />
              {r.my_quote ? (
                <p className="mk-your-quote">
                  {`Your quote: ${euro(r.my_quote.price_cents)} · ${when(r.my_quote.starts_at)} · ${durationLabel(r.my_quote.minutes)}`}
                </p>
              ) : null}
              <div className="mk-buttons">
                {r.tab === 'to_quote' && (
                  <button className="button button-small" onClick={() => quote(r)}>
                    Send quote
                  </button>
                )}
                {r.tab === 'won' && (
                  <a className="button button-small" href="#bookings">
                    Open booking
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="dash-empty">
          <p>
            {tab === 'to_quote'
              ? 'No requests waiting. We’ll tell you when a driver near you asks for help.'
              : tab === 'sent'
                ? 'Quotes you send show up here until the driver decides.'
                : tab === 'won'
                  ? 'Quotes drivers accept show up here.'
                  : 'Quotes that weren’t chosen show up here.'}
          </p>
        </div>
      )}
    </>
  );
}
