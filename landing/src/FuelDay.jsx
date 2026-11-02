import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  GasPumpIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import { FUEL_FUNNEL_DAYS, FUEL_TARGET, normalisePass, passLink } from './fuelday.js';
import './fuelday.css';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const dayText = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
const clock = (iso) =>
  new Date(iso).toLocaleTimeString('en-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const stamp = (iso) =>
  new Date(iso).toLocaleString('en-FI', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const PHASES = { draft: 'Draft', live: 'Live', over: 'Over', ended: 'Ended' };

function Qr({ text }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [text]);
  return src ? <img className="fd-qr" src={src} alt="Pass QR code" /> : null;
}

export function fuelOffer(data) {
  return data?.['fuel-day']?.day?.phase === 'live' ? data['fuel-day'] : null;
}

export function DriverFuelDay({ data, open, reload }) {
  const info = data['fuel-day'];
  const cars = data.vehicles.filter((v) => v.registration);
  const [car, setCar] = useState(cars[0]?.id || '');
  const [busy, setBusy] = useState(false);
  if (!info?.day)
    return (
      <div className="dash-empty">
        <GasPumpIcon size={30} />
        <h2>No Fuel Day right now</h2>
        <p>We’ll let you know when the next one is on.</p>
      </div>
    );
  const { day, pass } = info;
  const claim = async () => {
    setBusy(true);
    try {
      await api('/fuel-day/passes', {
        method: 'POST',
        body: { fuel_day_id: day.id, vehicle_id: car },
      });
      toast('Your pass is ready. Show it at the station.');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const release = () =>
    open({
      silent: true,
      title: 'Give up your place?',
      note: 'Your pass stops working and someone else can take the place.',
      cancel: 'Keep my pass',
      submit: 'Give up my place',
      save: async () => {
        await api(`/fuel-day/passes/${pass.code}`, { method: 'DELETE', body: {} });
        toast('Place released');
      },
    });
  const taken = Math.min(100, Math.round((day.claimed / day.cap) * 100));
  return (
    <div className="fd-driver">
      <article className="dash-tile fd-offer">
        <GasPumpIcon size={30} />
        <span className="eyebrow">FUEL DAY</span>
        <h2>{`${euro(day.amount_cents)} of fuel on us`}</h2>
        <p className="fd-station">
          <strong>{day.station_name}</strong>
          {` · ${day.station_address}`}
        </p>
        <p>{`${dayText(day.date)}, ${day.start_time}–${day.end_time}`}</p>
        {day.phase === 'live' ? (
          <>
            <div className="fd-bar" aria-hidden="true">
              <span style={{ width: `${taken}%` }} />
            </div>
            <p className="dash-help">{`${day.places_left} of ${day.cap} places left`}</p>
          </>
        ) : (
          <p className="mk-note">This Fuel Day is over.</p>
        )}
      </article>

      {pass ? (
        <article className={`dash-tile fd-pass${pass.used_at ? ' used' : ''}`}>
          <div>
            <span className="eyebrow">YOUR PASS</span>
            <h2 className="fd-code">{pass.code}</h2>
            <p>{`${pass.car_label} · ${pass.plate}`}</p>
            <p className={pass.used_at ? 'fd-status used' : 'fd-status'}>
              {pass.used_at ? `Fuel paid · ${stamp(pass.used_at)}` : 'Ready to use'}
            </p>
            {!pass.used_at && (
              <p className="dash-help">
                Show this code at the counter. The attendant scans it and pays for your fuel.
              </p>
            )}
            {!pass.used_at && day.phase === 'live' && (
              <button className="dash-text-button muted" onClick={release}>
                Give up my place
              </button>
            )}
          </div>
          {!pass.used_at && <Qr text={passLink(location.origin, pass.code)} />}
        </article>
      ) : day.phase === 'live' ? (
        <article className="dash-tile fd-claim">
          <h3>Which car?</h3>
          {cars.length ? (
            <div className="dash-checks mk-choices">
              {cars.map((v) => (
                <label key={v.id}>
                  <input
                    type="radio"
                    name="fuel-car"
                    checked={car === v.id}
                    onChange={() => setCar(v.id)}
                  />
                  {`${v.make} ${v.model} · ${v.registration}`}
                </label>
              ))}
            </div>
          ) : (
            <p className="dash-help">
              Add your car first, with its plate number, under My vehicles.
            </p>
          )}
          <h3>How it works</h3>
          <ol className="fd-steps">
            <li>Get your pass here. One pass per driver and per car.</li>
            <li>{`Drive to ${day.station_name} on ${dayText(day.date)}.`}</li>
            <li>Show the QR code to the attendant before you fill up.</li>
            <li>{`MotoDoc pays ${euro(day.amount_cents)} of your fuel.`}</li>
          </ol>
          <button
            className="button button-small"
            disabled={busy || !cars.length || !day.places_left}
            onClick={claim}
          >
            {day.places_left
              ? busy
                ? 'Getting your pass…'
                : 'Get my pass'
              : 'All passes are taken'}
          </button>
        </article>
      ) : null}
    </div>
  );
}

const emptyForm = () => ({
  station_name: '',
  station_address: '',
  date: new Date().toISOString().slice(0, 10),
  start_time: '10:00',
  end_time: '18:00',
  amount: 10,
  cap: 100,
});

export function AdminFuelDay({ open }) {
  const [state, setState] = useState(null),
    [pick, setPick] = useState(''),
    [form, setForm] = useState(null),
    [creating, setCreating] = useState(false),
    [code, setCode] = useState(() => new URLSearchParams(location.search).get('pass') || ''),
    [check, setCheck] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await api(`/admin/fuel-days${pick ? `?id=${pick}` : ''}`);
      setState(r);
      if (r.day) {
        setForm({
          station_name: r.day.station_name,
          station_address: r.day.station_address,
          date: r.day.date,
          start_time: r.day.start_time,
          end_time: r.day.end_time,
          amount: r.day.amount_cents / 100,
          cap: r.day.cap,
        });
        setCreating(false);
      } else {
        setForm(emptyForm());
        setCreating(true);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [pick]);
  useEffect(() => {
    load();
  }, [load]);
  const lookup = useCallback(async (value) => {
    const normal = normalisePass(value);
    if (!normal) return;
    try {
      setCheck(await api(`/admin/fuel-passes/${encodeURIComponent(normal)}`));
    } catch (e) {
      toast(e.message, 'error');
    }
  }, []);
  useEffect(() => {
    if (code) lookup(code);
  }, []);
  if (!state || !form) return <p className="dash-help">Loading…</p>;

  const day = creating ? null : state.day;
  const body = () => ({ ...form, amount: Number(form.amount), cap: Number(form.cap) });
  const call = async (path, method, payload, message) => {
    await api(path, { method, body: payload || {} });
    toast(message);
    await load();
  };
  const save = () => {
    if (creating)
      return call('/admin/fuel-days', 'POST', body(), 'Fuel Day created as a draft').catch((e) =>
        toast(e.message, 'error'),
      );
    if (day.status === 'live')
      return open({
        title: 'Save changes?',
        note: 'Drivers see the changes in the app right away.',
        submit: 'Save changes',
        save: () => call(`/admin/fuel-days/${day.id}`, 'PUT', body(), 'Fuel Day updated'),
      });
    call(`/admin/fuel-days/${day.id}`, 'PUT', body(), 'Fuel Day updated').catch((e) =>
      toast(e.message, 'error'),
    );
  };
  const live = () =>
    open({
      title: 'Open Fuel Day to drivers?',
      note: `Every driver gets a notification. Budget: ${euro(day.amount_cents * day.cap)} (${day.cap} × ${euro(day.amount_cents)}).`,
      submit: 'Go live',
      save: async () => {
        const r = await api(`/admin/fuel-days/${day.id}/live`, { method: 'POST', body: {} });
        toast(`Fuel Day is live. ${r.notified} drivers notified.`);
        await load();
      },
    });
  const end = () =>
    open({
      title: 'End Fuel Day?',
      note: 'Drivers can’t get passes any more and unused passes stop working.',
      submit: 'End Fuel Day',
      save: () => call(`/admin/fuel-days/${day.id}/end`, 'POST', {}, 'Fuel Day ended'),
    });
  const markUsed = (p) =>
    open({
      title: 'Mark pass as used?',
      note: `Check the plate matches the car at the pump: ${p.plate}. Pay ${euro(p.amount_cents)} at the pump first.`,
      submit: 'Mark as used',
      save: async () => {
        await api(`/admin/fuel-passes/${p.code}/use`, { method: 'POST', body: {} });
        toast('Marked as used');
        await lookup(p.code);
        await load();
      },
    });
  const undo = (p) =>
    open({
      title: 'Undo used?',
      note: 'Only if the pass was marked by mistake and no fuel was paid.',
      submit: 'Undo',
      save: async () => {
        await api(`/admin/fuel-passes/${p.code}/undo`, { method: 'POST', body: {} });
        toast('Pass is unused again');
        await lookup(p.code);
        await load();
      },
    });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const f = state.funnel;
  const pct = (n) => (f?.got ? `${Math.round((n / f.got) * 100)}%` : '0%');

  return (
    <>
      <form
        className="dash-tile fd-check"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <h2>Check a pass</h2>
        <div className="fd-check-row">
          <input
            aria-label="Pass code"
            placeholder="FD-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
          />
          <button className="button button-small">
            <MagnifyingGlassIcon size={16} /> Check
          </button>
        </div>
        {check && (
          <div className={`fd-result ${check.status}`} role="status">
            {check.status === 'not_found' && (
              <p>
                <XCircleIcon size={20} /> {`No pass with this code (${check.code})`}
              </p>
            )}
            {check.status === 'used' && (
              <>
                <p>
                  <XCircleIcon size={20} /> {`Already used · ${clock(check.pass.used_at)}`}
                </p>
                <p>{`Marked by ${check.pass.used_by} · ${check.pass.plate}`}</p>
                <button type="button" className="dash-text-button" onClick={() => undo(check.pass)}>
                  Undo used
                </button>
              </>
            )}
            {check.status === 'ended' && (
              <p>
                <XCircleIcon size={20} /> This Fuel Day has ended, so the pass no longer works.
              </p>
            )}
            {check.status === 'not_today' && (
              <p>
                <WarningIcon size={20} /> {`This pass is for ${dayText(check.pass.date)}`}
              </p>
            )}
            {check.status === 'valid' && (
              <>
                <p className="fd-valid">
                  <CheckCircleIcon size={22} weight="fill" /> Valid pass
                </p>
                <p>
                  <strong>{check.pass.code}</strong>
                  {` · ${check.pass.driver_name} · ${check.pass.car_label} · `}
                  <strong>{check.pass.plate}</strong>
                </p>
                <p>{`Pay ${euro(check.pass.amount_cents)} at the pump, then mark the pass used.`}</p>
                <button
                  type="button"
                  className="button fd-big"
                  onClick={() => markUsed(check.pass)}
                >
                  Mark as used
                </button>
              </>
            )}
            <button
              type="button"
              className="dash-text-button"
              onClick={() => {
                setCheck(null);
                setCode('');
                history.replaceState(null, '', '/admin#fuel-day');
              }}
            >
              Next driver
            </button>
          </div>
        )}
      </form>

      {day && (
        <div className="dash-stats ac-tiles">
          {[
            ['Passes claimed', `${day.claimed} / ${day.cap}`],
            ['Used at the pump', day.used],
            ['Places left', Math.max(0, day.cap - day.claimed)],
            [
              'Fuel paid',
              `${euro(day.used * day.amount_cents)} / ${euro(day.cap * day.amount_cents)}`,
            ],
          ].map(([label, value]) => (
            <article key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      )}

      <article className="dash-tile fd-setup">
        <div className="fd-setup-head">
          <h2>Fuel Day setup</h2>
          {state.days.length > 0 && (
            <select
              aria-label="Choose a Fuel Day"
              value={creating ? '' : day?.id}
              onChange={(e) => setPick(e.target.value)}
            >
              {creating && <option value="">New Fuel Day</option>}
              {state.days.map((d) => (
                <option key={d.id} value={d.id}>
                  {`${d.date} · ${d.station_name} · ${PHASES[d.phase]}`}
                </option>
              ))}
            </select>
          )}
          {!creating && (
            <button
              className="dash-secondary"
              onClick={() => {
                setCreating(true);
                setForm(emptyForm());
              }}
            >
              <PlusIcon size={15} /> New Fuel Day
            </button>
          )}
        </div>
        <div className="fd-form">
          <label className="dash-field">
            Station
            <input value={form.station_name} onChange={set('station_name')} maxLength={100} />
          </label>
          <label className="dash-field">
            Address
            <input value={form.station_address} onChange={set('station_address')} maxLength={200} />
          </label>
          <label className="dash-field">
            Date
            <input type="date" value={form.date} onChange={set('date')} />
          </label>
          <label className="dash-field">
            From
            <input type="time" value={form.start_time} onChange={set('start_time')} />
          </label>
          <label className="dash-field">
            To
            <input type="time" value={form.end_time} onChange={set('end_time')} />
          </label>
          <label className="dash-field">
            Fuel per pass (€)
            <input type="number" min={1} step={1} value={form.amount} onChange={set('amount')} />
          </label>
          <label className="dash-field">
            Number of passes
            <input type="number" min={1} step={1} value={form.cap} onChange={set('cap')} />
          </label>
        </div>
        <p className="dash-help">
          {`Budget: ${euro(Math.round(Number(form.amount || 0) * 100) * Number(form.cap || 0))}`}
        </p>
        <div className="ac-buttons">
          {(creating || day?.status !== 'ended') && (
            <button className="button button-small" onClick={save}>
              {creating ? 'Create' : 'Save'}
            </button>
          )}
          {!creating && day?.status === 'draft' && (
            <button className="button button-small" onClick={live}>
              Go live
            </button>
          )}
          {!creating && day && day.status !== 'ended' && (
            <button className="dash-text-button muted" onClick={end}>
              End Fuel Day
            </button>
          )}
          {creating && state.day && (
            <button className="dash-text-button" onClick={load}>
              Cancel
            </button>
          )}
        </div>
      </article>

      {day && f && (
        <>
          <div className="dash-section-heading">
            <h2>What these drivers did next</h2>
          </div>
          <p className="dash-help">
            {`Within ${FUEL_FUNNEL_DAYS} days of getting a pass. Drivers who were already customers aren’t counted${f.excluded ? ` (${f.excluded} left out)` : ''}. Scale up only if at least 10–15% request a quote or book a mechanic.`}
          </p>
          <div className="dash-list fd-funnel">
            {[
              ['Got a pass', f.got],
              ['Came to the station', f.used],
              ['Requested a quote', f.quote],
              ['Booked a mechanic', f.booking],
              ['Joined a garage membership', f.membership],
              ['Quote or booking', f.either],
            ].map(([label, n]) => (
              <article className="dash-row" key={label}>
                <div className="dash-row-body">
                  <h3>{label}</h3>
                  <div className="fd-bar" aria-hidden="true">
                    <span style={{ width: f.got ? `${(n / f.got) * 100}%` : 0 }} />
                  </div>
                </div>
                <strong>{`${n} · ${pct(n)}`}</strong>
              </article>
            ))}
          </div>
          <p className={`fd-verdict ${f.verdict}`}>
            {f.verdict === 'too_early'
              ? `Too early to tell. Target: ${FUEL_TARGET * 100}% quote or booking.`
              : f.verdict === 'meets'
                ? `Meets target: ${Math.round(f.rate * 100)}% quote or booking.`
                : `Below target: ${Math.round(f.rate * 100)}% quote or booking.`}
          </p>
          <div className="dash-section-heading">
            <h2>Passes</h2>
            <a className="dash-secondary" href={`/api/admin/fuel-days/${day.id}/export`}>
              <DownloadSimpleIcon size={16} /> Export CSV
            </a>
          </div>
          {state.passes.length ? (
            <div className="dash-list">
              {state.passes.map((p) => (
                <article className="dash-row" key={p.code}>
                  <div className="dash-row-body">
                    <div className="dash-row-title">
                      <h3>{p.code}</h3>
                      <span className="mem-pill">{p.used_at ? 'Used' : 'Claimed'}</span>
                    </div>
                    <p>{`${p.driver_name} · ${p.car_label} · ${p.plate}`}</p>
                    <p>
                      {`Claimed ${stamp(p.claimed_at)}${p.used_at ? ` · Used ${stamp(p.used_at)} by ${p.used_by}` : ''}`}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="dash-help">No passes claimed yet.</p>
          )}
        </>
      )}
    </>
  );
}
