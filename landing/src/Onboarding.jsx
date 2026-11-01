import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarCheckIcon,
  CarIcon,
  CheckCircleIcon,
  CrownIcon,
  GiftIcon,
  ThumbsUpIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Brand } from './Brand.jsx';
import { flash, toast } from './Toasts.jsx';
import {
  COMMON_SERVICES,
  FI_PLATE,
  SPECIALIZATIONS,
  WEEKDAYS,
  defaultHours,
  formatPlate,
  hoursProblem,
  validBusinessId,
} from './finland.js';
import './onboarding.css';

export function playChime() {
  try {
    const context = new AudioContext();
    [880, 1318.5].forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.16;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    });
  } catch {}
}

function Progress({ steps, current }) {
  return (
    <ol className="ob-progress" aria-label="Progress">
      {steps.map((label, i) => (
        <li
          key={label}
          className={i <= current ? 'done' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span />
          {label}
        </li>
      ))}
    </ol>
  );
}

function Toggle({ label, description, checked, onChange, children }) {
  return (
    <label className="ob-toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
        {children}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className="ob-chip" aria-pressed={active} onClick={onClick}>
      {active && <CheckCircleIcon size={15} weight="fill" aria-hidden="true" />}
      {children}
    </button>
  );
}

function Plate({ value }) {
  const text = value ? formatPlate(value) : 'ABC-123';
  return (
    <div className={`ob-plate${value ? '' : ' empty'}`} aria-hidden="true">
      <span>FIN</span>
      <strong>{text}</strong>
    </div>
  );
}

function Shell({ children, aside }) {
  return (
    <div className="ob-page">
      <header className="ob-header" data-fit>
        <Brand href="/" />
        <span data-lang-switch />
        {aside}
      </header>
      <main className="ob-main">{children}</main>
    </div>
  );
}

function useSuggestions(path) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!path) return setItems([]);
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api(path, { signal: controller.signal })
          .then((list) => setItems(Array.isArray(list) ? list.slice(0, 40) : []))
          .catch(() => {}),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path]);
  return items;
}

function SetupWizard({ user, profile }) {
  const garage = user.role === 'garage';
  const steps = garage
    ? ['You', 'Your garage', 'Services', 'Hours', 'Alerts']
    : ['You', 'Your car', 'Alerts'];
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(user.phone || '');
  const [terms, setTerms] = useState(user.termsAccepted);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [sound, setSound] = useState(true);
  const [car, setCar] = useState({
    plate: '',
    make: '',
    model: '',
    year: String(new Date().getFullYear() - 5),
  });
  const defaultName = profile?.name && !/’s garage$/.test(profile.name) ? profile.name : '';
  const [shop, setShop] = useState({
    name: defaultName,
    address: profile?.address || '',
    business_id: profile?.business_id || '',
    services: profile?.services?.length ? profile.services : COMMON_SERVICES.slice(0, 3),
    specializations: profile?.specializations || [],
    main_focus: profile?.main_focus || '',
    hourly_rate: String(profile?.hourly_rate || 75),
    hours: profile?.hours || defaultHours(),
  });
  const makes = useSuggestions(
    car.make.trim().length >= 1 ? `/catalog/makes?q=${encodeURIComponent(car.make.trim())}` : '',
  );
  const models = useSuggestions(
    car.make.trim()
      ? `/catalog/models?make=${encodeURIComponent(car.make.trim())}&q=${encodeURIComponent(car.model.trim())}`
      : '',
  );
  const first = user.name.split(' ')[0];
  const plateError = car.plate.trim().length >= 3 && !FI_PLATE.test(car.plate.trim());
  const idError = shop.business_id.trim() && !validBusinessId(shop.business_id.trim());
  const hoursError = hoursProblem(shop.hours);
  const name = steps[step];
  const valid =
    name === 'You'
      ? terms
      : name === 'Your car'
        ? FI_PLATE.test(car.plate.trim()) &&
          car.make.trim() &&
          car.model.trim() &&
          Number(car.year) >= 1950
        : name === 'Your garage'
          ? shop.name.trim().length > 1 && shop.address.trim().length > 3 && !idError
          : name === 'Services'
            ? shop.services.length > 0 &&
              shop.specializations.length > 0 &&
              Number(shop.hourly_rate) > 0
            : name === 'Hours'
              ? !hoursError
              : true;
  const toggle = (list, value) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const setSpecs = (specializations) =>
    setShop((s) => ({
      ...s,
      specializations,
      main_focus: specializations.includes(s.main_focus) ? s.main_focus : specializations[0] || '',
    }));
  const setDay = (key, patch) =>
    setShop((s) => ({ ...s, hours: { ...s.hours, [key]: { ...s.hours[key], ...patch } } }));
  const finish = async () => {
    setBusy(true);
    try {
      const body = {
        phone,
        terms,
        email_updates: emailUpdates,
        ...(garage
          ? {
              request_sound: sound,
              garage: {
                ...shop,
                name: shop.name.trim(),
                address: shop.address.trim(),
                business_id: shop.business_id.trim(),
                hourly_rate: Number(shop.hourly_rate),
              },
            }
          : {
              car: {
                plate: car.plate.trim(),
                make: car.make.trim(),
                model: car.model.trim(),
                year: Number(car.year),
              },
            }),
      };
      const result = await api('/onboarding', { method: 'POST', body });
      if (garage) location.assign(`${result.next}?from=onboarding`);
      else {
        flash('You’re all set. Welcome to MotoDoc.');
        location.assign(`${result.next}?from=onboarding`);
      }
    } catch (error) {
      toast(error.message, 'error');
      setBusy(false);
    }
  };
  const next = () => (step === steps.length - 1 ? finish() : setStep(step + 1));

  return (
    <Shell>
      <Progress steps={steps} current={step} />
      <section className="ob-card" aria-labelledby="ob-title" key={step}>
        {name === 'You' && (
          <>
            <h1 id="ob-title">{`Welcome, ${first}`}</h1>
            <p className="ob-sub">
              {garage
                ? 'Let’s set up your garage. It takes about a minute.'
                : 'Let’s add your car. It takes about a minute.'}
            </p>
            <label className="ob-field">
              <span>Phone (optional)</span>
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+358 40 123 4567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <small>
                {garage ? 'Shown to customers who book you.' : 'Only shared with garages you book.'}
              </small>
            </label>
            {!garage && (
              <ul className="ob-benefits">
                <li>
                  <CalendarCheckIcon size={20} aria-hidden="true" />
                  <span>
                    <strong>Book a service in a few taps</strong>
                    <small>Compare garages, prices and times.</small>
                  </span>
                </li>
                <li>
                  <BellIcon size={20} aria-hidden="true" />
                  <span>
                    <strong>Never miss a deadline</strong>
                    <small>Inspection, insurance and tax reminders.</small>
                  </span>
                </li>
              </ul>
            )}
            {!user.termsAccepted && (
              <label className="ob-terms">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                />
                <span>
                  I accept the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    terms of service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    privacy policy
                  </a>
                  .
                </span>
              </label>
            )}
          </>
        )}

        {name === 'Your car' && (
          <>
            <h1 id="ob-title">Add your car</h1>
            <p className="ob-sub">
              Garages see this when you book, so you don’t have to type it again.
            </p>
            <Plate value={car.plate.trim()} />
            <label className="ob-field">
              <span>Registration number</span>
              <input
                value={car.plate}
                maxLength={7}
                autoCapitalize="characters"
                placeholder="ABC-123"
                aria-invalid={plateError}
                onChange={(event) => setCar({ ...car, plate: event.target.value.toUpperCase() })}
              />
              {plateError && (
                <small className="ob-error">Use the Finnish format, for example ABC-123.</small>
              )}
            </label>
            <div className="ob-row">
              <label className="ob-field">
                <span>Make</span>
                <input
                  list="ob-makes"
                  value={car.make}
                  placeholder="Toyota"
                  onChange={(event) => setCar({ ...car, make: event.target.value, model: '' })}
                />
                <datalist id="ob-makes">
                  {makes.map((make) => (
                    <option key={make} value={make} />
                  ))}
                </datalist>
              </label>
              <label className="ob-field">
                <span>Model</span>
                <input
                  list="ob-models"
                  value={car.model}
                  placeholder="Corolla"
                  onChange={(event) => setCar({ ...car, model: event.target.value })}
                />
                <datalist id="ob-models">
                  {models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>
              <label className="ob-field ob-year">
                <span>Year</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                  value={car.year}
                  onChange={(event) => setCar({ ...car, year: event.target.value })}
                />
              </label>
            </div>
          </>
        )}

        {name === 'Your garage' && (
          <>
            <h1 id="ob-title">Your garage</h1>
            <p className="ob-sub">This is what drivers see on Find a Mechanic.</p>
            <label className="ob-field">
              <span>Garage name</span>
              <input
                value={shop.name}
                placeholder="Helsinki Auto Center"
                onChange={(event) => setShop({ ...shop, name: event.target.value })}
              />
            </label>
            <label className="ob-field">
              <span>Street address and city</span>
              <input
                value={shop.address}
                autoComplete="street-address"
                placeholder="Mannerheimintie 42, 00100 Helsinki"
                onChange={(event) => setShop({ ...shop, address: event.target.value })}
              />
            </label>
            <label className="ob-field">
              <span>Business ID (Y-tunnus, optional)</span>
              <input
                value={shop.business_id}
                maxLength={9}
                placeholder="1234567-1"
                aria-invalid={!!idError}
                onChange={(event) => setShop({ ...shop, business_id: event.target.value })}
              />
              <small className={idError ? 'ob-error' : ''}>
                {idError
                  ? 'This Business ID doesn’t look right. Check the digits, for example 1234567-1.'
                  : 'Shown on your invoices. You can add it later.'}
              </small>
            </label>
          </>
        )}

        {name === 'Services' && (
          <>
            <h1 id="ob-title">What do you offer?</h1>
            <p className="ob-sub">
              Pick the services you do. You can add prices and more services later.
            </p>
            <div className="ob-chips">
              {[...new Set([...COMMON_SERVICES, ...shop.services])].map((service) => (
                <Chip
                  key={service}
                  active={shop.services.includes(service)}
                  onClick={() => setShop({ ...shop, services: toggle(shop.services, service) })}
                >
                  {service}
                </Chip>
              ))}
            </div>
            <h2>What do you specialise in?</h2>
            <p className="ob-hint">Pick all that apply. Drivers can filter garages by these.</p>
            <div className="ob-chips">
              {SPECIALIZATIONS.map(([key, label]) => (
                <Chip
                  key={key}
                  active={shop.specializations.includes(key)}
                  onClick={() => setSpecs(toggle(shop.specializations, key))}
                >
                  {label}
                </Chip>
              ))}
            </div>
            {shop.specializations.length > 1 && (
              <fieldset className="ob-focus">
                <legend>Your main focus</legend>
                <p className="ob-hint">Shown first on your garage card.</p>
                {shop.specializations.map((key) => (
                  <label key={key}>
                    <input
                      type="radio"
                      name="focus"
                      checked={shop.main_focus === key}
                      onChange={() => setShop({ ...shop, main_focus: key })}
                    />
                    {SPECIALIZATIONS.find(([k]) => k === key)[1]}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="ob-field ob-rate">
              <span>Hourly rate (€, incl. VAT)</span>
              <input
                type="number"
                min="1"
                inputMode="decimal"
                value={shop.hourly_rate}
                onChange={(event) => setShop({ ...shop, hourly_rate: event.target.value })}
              />
              <small>Shown on your profile and used for quotes.</small>
            </label>
          </>
        )}

        {name === 'Hours' && (
          <>
            <h1 id="ob-title">When are you open?</h1>
            <p className="ob-sub">
              Drivers can only book times inside these hours. Switch a day off to close it.
            </p>
            <button
              type="button"
              className="ob-link"
              onClick={() =>
                setShop((s) => ({
                  ...s,
                  hours: Object.fromEntries(
                    WEEKDAYS.map(([key]) => [
                      key,
                      ['sat', 'sun'].includes(key) ? s.hours[key] : { ...s.hours.mon },
                    ]),
                  ),
                }))
              }
            >
              Copy Monday to all weekdays
            </button>
            <ul className="ob-hours">
              {WEEKDAYS.map(([key, label]) => {
                const day = shop.hours[key];
                const bad = day.open && !(day.to > day.from);
                return (
                  <li key={key} className={day.open ? '' : 'closed'}>
                    <label className="ob-day">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={day.open}
                        onChange={(event) => setDay(key, { open: event.target.checked })}
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
                          onChange={(event) => setDay(key, { from: event.target.value })}
                        />
                        <span aria-hidden="true">–</span>
                        <input
                          type="time"
                          aria-label={`${label} closes`}
                          value={day.to}
                          aria-invalid={bad}
                          onChange={(event) => setDay(key, { to: event.target.value })}
                        />
                      </span>
                    ) : (
                      <span className="ob-closed">No bookings this day</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {hoursError && <p className="ob-error">{hoursError}</p>}
          </>
        )}

        {name === 'Alerts' && (
          <>
            <h1 id="ob-title">How should we reach you?</h1>
            <p className="ob-sub">You can change these any time in Settings.</p>
            <div className="ob-toggles">
              <div className="ob-toggle static">
                <span>
                  <strong>In the app</strong>
                  <small>Shown in your notifications.</small>
                </span>
                <em>Always on</em>
              </div>
              <Toggle
                label="Email me about important updates"
                description={
                  garage
                    ? 'New requests, accepted quotes, cancellations and unanswered messages.'
                    : 'Approvals, quotes, changes to your bookings and unanswered messages.'
                }
                checked={emailUpdates}
                onChange={setEmailUpdates}
              />
              {garage && (
                <Toggle
                  label="Play a sound for new requests"
                  description="So you notice new work while the dashboard is open."
                  checked={sound}
                  onChange={(value) => {
                    setSound(value);
                    if (value) playChime();
                  }}
                />
              )}
            </div>
            {!garage && (
              <div className="ob-summary">
                <CarIcon size={20} aria-hidden="true" />
                <span>
                  {car.make} {car.model} {car.year}
                </span>
                <Plate value={car.plate.trim()} />
              </div>
            )}
          </>
        )}

        <footer className="ob-footer">
          {step > 0 ? (
            <button type="button" className="ob-back" onClick={() => setStep(step - 1)}>
              <ArrowLeftIcon size={17} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="button ob-next" disabled={!valid || busy} onClick={next}>
            {busy
              ? 'Saving…'
              : step < steps.length - 1
                ? 'Continue'
                : garage
                  ? 'Next: your membership'
                  : 'Finish'}
            {!busy && <ArrowRightIcon size={17} aria-hidden="true" />}
          </button>
        </footer>
      </section>
    </Shell>
  );
}

const BASIC_INCLUDES = [
  'All your service history in one place',
  'Inspection & service reminders',
  'Direct contact with garage',
  'Basic support via chat',
];

function MembershipWizard({ profile, fromOnboarding }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [price, setPrice] = useState(49);
  const [rate, setRate] = useState(String(profile.hourly_rate || 75));
  const [memberRate, setMemberRate] = useState(
    String(profile.member_rate || Math.round((profile.hourly_rate || 75) * 0.9)),
  );
  const [picked, setPicked] = useState(['priority', 'safety', 'katsastus']);
  const [days, setDays] = useState('5');
  const [oilPrice, setOilPrice] = useState('69');
  const [ownPerk, setOwnPerk] = useState('');
  const city = (profile.city || profile.address?.split(',').pop() || '').replace(/\d+/g, '').trim();
  const perkOptions = useMemo(
    () => [
      ['priority', `Priority booking within ${days} days`],
      ['safety', 'Free annual safety check (30 min)'],
      ['katsastus', 'Free katsastus prep check before inspection'],
      ['pickup', city ? `Pickup & drop-off in ${city}` : 'Pickup & drop-off'],
      ['loaner', 'Free loaner car during service'],
      ['oil', `Fixed-price oil change once a year (€${Number(oilPrice) || 69})`],
    ],
    [days, oilPrice, city],
  );
  const perks = perkOptions.filter(([key]) => picked.includes(key)).map(([, label]) => label);
  const rateValue = Number(rate),
    memberValue = Number(memberRate);
  const rateError = memberValue > rateValue;
  const share = Math.round(price * 0.7);
  const valid =
    step === 1
      ? rateValue > 0 && memberValue > 0 && !rateError
      : step === 2
        ? picked.length >= 3 && (!picked.includes('oil') || Number(oilPrice) > 0)
        : true;
  const steps = 6;
  const launch = async () => {
    setBusy(true);
    try {
      await api('/garage/membership', {
        method: 'POST',
        body: {
          price,
          hourly_rate: rateValue,
          member_rate: memberValue,
          perks,
          own_perk: ownPerk.trim(),
        },
      });
      setConfirming(false);
      setStep(5);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      aside={
        fromOnboarding &&
        step < 5 && (
          <a className="ob-later" href="/app?from=onboarding">
            Set up later
          </a>
        )
      }
    >
      <div className="ob-dots" aria-label={`Step ${step + 1} of ${steps}`}>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <section className="ob-card ob-membership" key={step} aria-labelledby="ob-title">
        {step === 0 && (
          <div className="ob-hero">
            {fromOnboarding && <span className="ob-eyebrow">Last step: your membership</span>}
            <span className="ob-crown">
              <CrownIcon size={26} aria-hidden="true" />
            </span>
            <h1 id="ob-title">Turn your regulars into members.</h1>
            <p className="ob-sub">
              Lock in customers for a year. Get paid for loyalty you already earn.
            </p>
            <small>Setup takes 4 minutes.</small>
          </div>
        )}

        {step === 1 && (
          <>
            <h1 id="ob-title">How it works</h1>
            <p className="ob-sub">
              Your plan is what drivers join to become your members. You set its price, your hourly
              rates and the perks.
            </p>
            <div className="ob-box">
              <h2>Set your yearly price</h2>
              <div className="ob-price">
                <strong>€{price}</strong>
                <span>per member / year</span>
              </div>
              <input
                type="range"
                min="29"
                max="59"
                step="1"
                value={price}
                aria-label="Yearly price"
                onChange={(event) => setPrice(Number(event.target.value))}
              />
              <dl className="ob-split">
                <div>
                  <dt>You receive</dt>
                  <dd>€{share}</dd>
                </div>
                <div>
                  <dt>MotoDoc fee (30%)</dt>
                  <dd>€{price - share}</dd>
                </div>
              </dl>
            </div>
            <div className="ob-box">
              <h2>Set your hourly rates</h2>
              <div className="ob-row">
                <label className="ob-field">
                  <span>Hourly rate (€)</span>
                  <input
                    type="number"
                    min="1"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />
                </label>
                <label className="ob-field">
                  <span>Member hourly rate (€)</span>
                  <input
                    type="number"
                    min="1"
                    value={memberRate}
                    aria-invalid={rateError}
                    onChange={(event) => setMemberRate(event.target.value)}
                  />
                </label>
              </div>
              <p className={rateError ? 'ob-error' : 'ob-hint'}>
                {rateError
                  ? 'The member hourly rate can’t be higher than your normal hourly rate.'
                  : `Members save €${Math.max(0, rateValue - memberValue)} on every hour of work.`}
              </p>
            </div>
            <p className="ob-note">
              MotoDoc handles payments, reminders, service history, and in-app booking. You handle
              great service.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="ob-title">Choose 3–4 perks to offer your members.</h1>
            <p className="ob-sub">This is what makes your membership worth €{price}.</p>
            <div className="ob-perks">
              {perkOptions.map(([key, label]) => (
                <div key={key} className={picked.includes(key) ? 'ob-perk on' : 'ob-perk'}>
                  <label>
                    <input
                      type="checkbox"
                      checked={picked.includes(key)}
                      onChange={() =>
                        setPicked((list) =>
                          list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
                        )
                      }
                    />
                    <GiftIcon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                  {key === 'priority' && picked.includes(key) && (
                    <select
                      aria-label="Within how many days"
                      value={days}
                      onChange={(event) => setDays(event.target.value)}
                    >
                      {['3', '5', '7', '10'].map((n) => (
                        <option key={n} value={n}>
                          {n} days
                        </option>
                      ))}
                    </select>
                  )}
                  {key === 'oil' && picked.includes(key) && (
                    <input
                      type="number"
                      min="1"
                      aria-label="Oil change price (€)"
                      className="ob-perk-price"
                      value={oilPrice}
                      onChange={(event) => setOilPrice(event.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="ob-selected">Selected: {picked.length} / 3–4 recommended</p>
          </>
        )}

        {step === 3 && (
          <>
            <h1 id="ob-title">Add one perk that’s just you.</h1>
            <p className="ob-sub">Something only your garage offers. Make it personal.</p>
            <label className="ob-field">
              <span>Your own perk (optional)</span>
              <input
                value={ownPerk}
                maxLength={60}
                onChange={(event) => setOwnPerk(event.target.value)}
              />
              <small>{ownPerk.length}/60</small>
            </label>
            <p className="ob-hint">Need inspiration?</p>
            <div className="ob-chips">
              {[
                'Free car wash with every service',
                'Free tyre storage for one season',
                'Free coffee while you wait',
              ].map((idea) => (
                <Chip key={idea} active={ownPerk === idea} onClick={() => setOwnPerk(idea)}>
                  {idea}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 id="ob-title">This is what drivers will see.</h1>
            <p className="ob-sub">Your plan as drivers see it in MotoDoc.</p>
            <article className="ob-plan">
              <span className="ob-recommended">
                <ThumbsUpIcon size={14} aria-hidden="true" /> Recommended
              </span>
              <small>Garage membership</small>
              <h2>{profile.name}</h2>
              <p className="ob-plan-price">
                <strong>€{price}</strong> / year
              </p>
              <p className="ob-plan-rate">
                Member hourly rate €{memberValue}/h {memberValue < rateValue && <s>€{rateValue}</s>}
              </p>
              <h3>What you get</h3>
              <ul>
                {BASIC_INCLUDES.map((line) => (
                  <li key={line}>
                    <CheckCircleIcon size={16} aria-hidden="true" /> {line}
                  </li>
                ))}
                {[...perks, ...(ownPerk.trim() ? [ownPerk.trim()] : [])].map((line) => (
                  <li key={line} className="perk">
                    <GiftIcon size={16} aria-hidden="true" /> {line}
                  </li>
                ))}
              </ul>
            </article>
            {confirming && (
              <div className="ob-confirm" role="alertdialog" aria-labelledby="ob-confirm-title">
                <h2 id="ob-confirm-title">Launch your membership?</h2>
                <p>
                  €{price}/yr · Hourly rate €{rateValue}/h · Member hourly rate €{memberValue}/h.
                  Drivers near you can join straight away. You can change prices later; members keep
                  what they paid until renewal.
                </p>
                <div>
                  <button type="button" className="ob-back" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button type="button" className="button" disabled={busy} onClick={launch}>
                    {busy ? 'Saving…' : 'Launch membership'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <div className="ob-hero">
            <span className="ob-crown live">
              <CheckCircleIcon size={28} weight="fill" aria-hidden="true" />
            </span>
            <h1 id="ob-title">You’re live.</h1>
            <p className="ob-sub">
              Your membership is visible to every MotoDoc driver near you. We’ll let you know the
              moment you get your first member.
            </p>
            <a
              className="button ob-next"
              href={fromOnboarding ? '/app?from=onboarding' : '/app#memberships'}
            >
              {fromOnboarding ? 'Go to your dashboard' : 'See your plan & members'}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </a>
          </div>
        )}

        {step < 5 && !confirming && (
          <footer className="ob-footer">
            {step > 0 ? (
              <button
                type="button"
                className="ob-back"
                onClick={() => setStep(step === 4 ? 3 : step - 1)}
              >
                <ArrowLeftIcon size={17} aria-hidden="true" /> {step === 4 ? 'Edit' : 'Back'}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="button ob-next"
              disabled={!valid}
              onClick={() => (step === 4 ? setConfirming(true) : setStep(step + 1))}
            >
              {step === 0 ? 'Get started' : step === 4 ? 'Launch membership' : 'Continue'}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </button>
          </footer>
        )}
      </section>
    </Shell>
  );
}

export function Onboarding() {
  const membership = location.pathname.startsWith('/onboarding/membership');
  const fromOnboarding = new URLSearchParams(location.search).get('from') === 'onboarding';
  const [state, setState] = useState(null);
  useEffect(() => {
    document.title = 'Set up MotoDoc — MotoDoc';
    api('/auth/me')
      .then(async ({ user }) => {
        if (user.admin && !user.demo) return location.replace('/admin');
        if (user.garageRole === 'mechanic') return location.replace('/app');
        if (membership) {
          if (user.role !== 'garage') return location.replace('/app');
          const profile = await api('/garage/profile');
          if (profile.membership_launched_at) return location.replace('/app#memberships');
          return setState({ user, profile });
        }
        if (user.onboarded) return location.replace('/app');
        const profile = user.role === 'garage' ? await api('/garage/profile') : null;
        setState({ user, profile });
      })
      .catch((error) => {
        if (error.status === 401) location.replace('/signup');
        else toast(error.message, 'error');
      });
  }, [membership]);
  if (!state)
    return (
      <Shell>
        <p className="ob-loading" role="status">
          Loading…
        </p>
      </Shell>
    );
  return membership ? (
    <MembershipWizard profile={state.profile} fromOnboarding={fromOnboarding} />
  ) : (
    <SetupWizard user={state.user} profile={state.profile} />
  );
}
