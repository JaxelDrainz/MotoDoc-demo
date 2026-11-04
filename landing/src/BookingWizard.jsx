import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, StarIcon, XIcon } from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import { SPECIALIZATIONS } from './finland.js';
import './booking-wizard.css';

const STEPS = [
  'Choose a garage',
  'What does your car need?',
  'Which car?',
  'When suits you?',
  'Anything to add?',
  'Check and send',
];
const priceOf = (s) =>
  s.price_min_cents == null
    ? 'Quote'
    : s.price_max_cents != null && s.price_max_cents !== s.price_min_cents
      ? `€${s.price_min_cents / 100}–${s.price_max_cents / 100}`
      : `from €${s.price_min_cents / 100}`;
const minutesOf = (s) => (s.minutes ? `~${s.minutes} min` : 'Varies');
const timeOf = (value) =>
  new Date(value).toLocaleTimeString('en-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const longDate = (value) =>
  new Date(value).toLocaleString('en-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });

function Calendar({ garageId, value, onChange }) {
  const [days, setDays] = useState(null),
    [error, setError] = useState(''),
    [month, setMonth] = useState(0),
    [day, setDay] = useState('');
  useEffect(() => {
    let alive = true;
    api(`/garages/${garageId}/availability?days=90`)
      .then((list) => {
        if (!alive) return;
        setDays(list);
        setDay((list.find((d) => d.slots.length) || list[0])?.date || '');
      })
      .catch(() => alive && setError('Available times could not be checked. Please try again.'));
    return () => {
      alive = false;
    };
  }, [garageId]);
  const byDate = useMemo(() => new Map((days || []).map((d) => [d.date, d])), [days]);
  if (error) return <p className="dash-error">{error}</p>;
  if (!days) return <p className="dash-help">Checking free times…</p>;
  const first = new Date(`${days[0].date}T12:00:00Z`);
  const shown = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + month, 1, 12));
  const lead = (shown.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(shown.getUTCFullYear(), shown.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from({ length: count }, (_, i) =>
      new Date(Date.UTC(shown.getUTCFullYear(), shown.getUTCMonth(), i + 1, 12))
        .toISOString()
        .slice(0, 10),
    ),
  ];
  const selected = byDate.get(day);
  return (
    <div className="bw-calendar">
      <div className="bw-month">
        <button type="button" disabled={month === 0} onClick={() => setMonth(month - 1)}>
          ←
        </button>
        <strong>
          {shown.toLocaleDateString('en-FI', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </strong>
        <button type="button" disabled={month >= 2} onClick={() => setMonth(month + 1)}>
          →
        </button>
      </div>
      <div className="bw-grid" role="grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {cells.map((date, i) =>
          date ? (
            <button
              type="button"
              key={date}
              disabled={!byDate.get(date)?.slots.length}
              aria-pressed={date === day}
              onClick={() => {
                setDay(date);
                onChange('');
              }}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      {selected?.slots.length ? (
        <div className="bw-times">
          {selected.slots.map((iso) => (
            <button
              type="button"
              key={iso}
              aria-pressed={value === iso}
              onClick={() => onChange(iso)}
            >
              {timeOf(iso)}
            </button>
          ))}
        </div>
      ) : (
        <p className="bw-reason">{selected?.reason || 'Choose a day with free times.'}</p>
      )}
      <p className="dash-help">Times are in Finnish time and follow the garage’s opening hours.</p>
    </div>
  );
}

export function BookingWizard({ garages, vehicles, initialGarage, onClose, onDone, navigate }) {
  const ref = useRef(null);
  const [step, setStep] = useState(initialGarage ? 1 : 0),
    [spec, setSpec] = useState(''),
    [all, setAll] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [sent, setSent] = useState(null);
  const [form, setForm] = useState({
    garage: initialGarage?.id || '',
    choice: '',
    custom: '',
    details: '',
    vehicle: vehicles.length === 1 ? vehicles[0].id : '',
    starts_at: '',
    mileage: '',
    notes: '',
    message: '',
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
  const garage = garages.find((g) => g.id === form.garage);
  const car = vehicles.find((v) => v.id === form.vehicle);
  const menu = garage?.menu?.length
    ? garage.menu
    : (garage?.services || []).map((name) => ({ id: name, name }));
  const item = menu.find((s) => s.name === form.choice);
  const serviceName =
    form.choice === 'diagnosis'
      ? 'I don’t know the issue'
      : form.choice === 'custom'
        ? form.custom.trim()
        : form.choice;
  const listed = garages.filter(
    (g) => g.online !== false && (!spec || (g.specializations || []).includes(spec)),
  );
  const problem = [
    () => (!form.garage ? 'Choose a garage.' : ''),
    () =>
      !form.choice
        ? 'Choose what your car needs.'
        : form.choice === 'custom' && !form.custom.trim()
          ? 'Say in a few words what you need.'
          : '',
    () => (!form.vehicle ? 'Choose a car.' : ''),
    () => (!form.starts_at ? 'Choose a day and time.' : ''),
    () =>
      form.mileage && car && Number(form.mileage) < car.mileage
        ? `The mileage can’t be lower than the last recorded ${car.mileage.toLocaleString('en-FI')} km.`
        : '',
    () => '',
  ];
  const next = () => {
    const p = problem[step]();
    if (p) return setError(p);
    setStep(step + 1);
  };
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const notes = [form.choice === 'custom' ? form.details.trim() : '', form.notes.trim()]
        .filter(Boolean)
        .join('\n');
      const { id } = await api('/bookings', {
        method: 'POST',
        body: {
          garage_id: form.garage,
          vehicle_id: form.vehicle,
          service: serviceName,
          kind: ['diagnosis', 'custom'].includes(form.choice) ? form.choice : 'service',
          starts_at: form.starts_at,
          notes,
          ...(form.mileage ? { mileage: Number(form.mileage) } : {}),
          ...(form.message.trim() ? { message: form.message.trim() } : {}),
        },
      });
      setSent(id);
      await onDone();
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="dash-dialog bw"
      aria-labelledby="bw-title"
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
      {sent ? (
        <div className="bw-sent">
          <CheckCircleIcon size={44} weight="fill" />
          <h2 id="bw-title">Request sent</h2>
          <p>The mechanic will approve, decline or suggest a new time. We’ll let you know.</p>
          <div className="dash-form-actions">
            <button
              type="button"
              className="dash-secondary"
              onClick={() => {
                onClose();
                navigate('overview');
              }}
            >
              Back to home
            </button>
            <button
              type="button"
              className="button button-small"
              onClick={() => {
                onClose();
                navigate('bookings');
              }}
            >
              View booking
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="eyebrow">{`STEP ${step + 1} OF ${STEPS.length}`}</span>
          <h2 id="bw-title">{STEPS[step]}</h2>
          <div className="mk-progress" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} className={i <= step ? 'done' : ''} />
            ))}
          </div>

          {step === 0 && (
            <>
              <div className="mk-tabs md-scroll-x" role="group" aria-label="Specialisation">
                <button className={!spec ? 'active' : ''} onClick={() => setSpec('')}>
                  All
                </button>
                {SPECIALIZATIONS.map(([key, label]) => (
                  <button
                    key={key}
                    className={spec === key ? 'active' : ''}
                    onClick={() => setSpec(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {listed.length ? (
                <div className="bw-options">
                  {listed.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      aria-pressed={form.garage === g.id}
                      onClick={() => set({ garage: g.id, choice: '', starts_at: '' })}
                    >
                      <strong>{g.name}</strong>
                      <span>
                        {g.review_count ? (
                          <>
                            <StarIcon size={12} weight="fill" /> {`${g.rating} · `}
                          </>
                        ) : null}
                        {g.city}
                        {g.open_now ? ' · Open now' : ''}
                      </span>
                      <small>
                        {[
                          g.hourly_rate && `€${g.hourly_rate}/h`,
                          g.member_rate && `Member €${g.member_rate}/h`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dash-help">No garages match. Try another specialisation.</p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="bw-options">
                {(all ? menu : menu.slice(0, 6)).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    aria-pressed={form.choice === s.name}
                    onClick={() => set({ choice: s.name })}
                  >
                    <strong>{s.name}</strong>
                    {s.price_min_cents !== undefined && (
                      <span>{`${priceOf(s)} · ${minutesOf(s)}`}</span>
                    )}
                  </button>
                ))}
              </div>
              {!all && menu.length > 6 && (
                <button type="button" className="dash-text-button" onClick={() => setAll(true)}>
                  {`Show all services (${menu.length})`}
                </button>
              )}
              <h3 className="bw-sub">Not on the list?</h3>
              <div className="bw-options">
                <button
                  type="button"
                  aria-pressed={form.choice === 'diagnosis'}
                  onClick={() => set({ choice: 'diagnosis' })}
                >
                  <strong>I don’t know the issue</strong>
                  <span>The garage finds out what’s wrong.</span>
                </button>
                <button
                  type="button"
                  aria-pressed={form.choice === 'custom'}
                  onClick={() => set({ choice: 'custom' })}
                >
                  <strong>Custom request</strong>
                  <span>Describe the job and get a quote.</span>
                </button>
              </div>
              {form.choice === 'custom' && (
                <>
                  <label className="dash-field">
                    What do you need?
                    <input
                      maxLength={80}
                      value={form.custom}
                      onChange={(e) => set({ custom: e.target.value })}
                    />
                  </label>
                  <label className="dash-field">
                    Describe the job
                    <textarea
                      rows={3}
                      maxLength={800}
                      value={form.details}
                      onChange={(e) => set({ details: e.target.value })}
                    />
                  </label>
                </>
              )}
            </>
          )}

          {step === 2 &&
            (vehicles.length ? (
              <div className="bw-options">
                {vehicles.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    aria-pressed={form.vehicle === v.id}
                    onClick={() => set({ vehicle: v.id })}
                  >
                    <strong>{`${v.make} ${v.model}`}</strong>
                    <span>{`${v.registration} · ${v.mileage.toLocaleString('en-FI')} km`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dash-empty">
                <p>Add your car first.</p>
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => {
                    onClose();
                    navigate('vehicles');
                  }}
                >
                  Add your car
                </button>
              </div>
            ))}

          {step === 3 && garage && (
            <Calendar
              garageId={garage.id}
              value={form.starts_at}
              onChange={(starts_at) => set({ starts_at })}
            />
          )}

          {step === 4 && (
            <>
              <label className="dash-field">
                Current mileage (km)
                <input
                  type="number"
                  min={0}
                  value={form.mileage}
                  placeholder={car ? String(car.mileage) : ''}
                  onChange={(e) => set({ mileage: e.target.value })}
                />
                {car && (
                  <small className="dash-help">{`Last recorded: ${car.mileage.toLocaleString('en-FI')} km`}</small>
                )}
              </label>
              <label className="dash-field">
                Notes for the garage
                <textarea
                  rows={3}
                  maxLength={800}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </label>
              <label className="dash-field">
                Message to the mechanic
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => set({ message: e.target.value })}
                />
                <small className="dash-help">
                  Starts a chat with the mechanic about this booking.
                </small>
              </label>
            </>
          )}

          {step === 5 && (
            <>
              <dl className="mk-summary">
                <dt>Garage</dt>
                <dd>{garage?.name}</dd>
                <dt>Service</dt>
                <dd>
                  {serviceName}
                  {item ? ` · ${priceOf(item)}` : ''}
                </dd>
                <dt>Car</dt>
                <dd>{car ? `${car.make} ${car.model} · ${car.registration}` : ''}</dd>
                <dt>When</dt>
                <dd>{form.starts_at ? longDate(form.starts_at) : ''}</dd>
                {form.mileage && (
                  <>
                    <dt>Mileage</dt>
                    <dd>{`${Number(form.mileage).toLocaleString('en-FI')} km`}</dd>
                  </>
                )}
                {(form.notes || form.details) && (
                  <>
                    <dt>Notes</dt>
                    <dd>{[form.details, form.notes].filter(Boolean).join(' · ')}</dd>
                  </>
                )}
                {form.message && (
                  <>
                    <dt>Message</dt>
                    <dd>{form.message}</dd>
                  </>
                )}
              </dl>
              <p className="dash-help">Prices include VAT. The garage confirms the final price.</p>
            </>
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
            {step < 5 ? (
              <button type="button" className="button button-small" onClick={next}>
                Continue
              </button>
            ) : (
              <button type="button" className="button button-small" disabled={busy} onClick={send}>
                {busy ? 'Sending…' : 'Send booking request'}
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
