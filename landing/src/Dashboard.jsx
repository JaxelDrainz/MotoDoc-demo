import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightIcon,
  DotsThreeIcon,
  WarningCircleIcon,
  BellIcon,
  ChatCircleIcon,
  GaugeIcon,
  CalendarBlankIcon,
  CarIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  GiftIcon,
  HouseIcon,
  ReceiptIcon,
  SignOutIcon,
  StarIcon,
  StorefrontIcon,
  UsersIcon,
  XIcon,
  PlusIcon,
  WrenchIcon,
  LockKeyIcon,
  ListChecksIcon,
  ChartBarIcon,
  QuestionIcon,
  UsersThreeIcon,
  LifebuoyIcon,
  ChatTextIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Brand } from './Brand.jsx';
import { Bell, SlotPicker, Status, ThemeToggle } from './DashParts.jsx';
import { flash, toast } from './Toasts.jsx';
import { DemoBar } from './Demo.jsx';
import { AccountSettings } from './Settings.jsx';
import { JobDetails, JobStatus, jobActions, toLocalInput } from './Jobs.jsx';
import { InvoicesPanel } from './Invoices.jsx';
import { AnalyticsPanel } from './GarageTools.jsx';
import { SPECIALIZATIONS } from './finland.js';
import {
  AvailabilityCard,
  ServicesPanel,
  durationText,
  priceText,
  specLabel,
} from './GarageTools.jsx';
import { GuidedTour } from './Tour.jsx';
import { NoAccess, TeamGate, TeamPanel } from './Team.jsx';
import { DriverMemberships, GarageMemberships } from './Memberships.jsx';
import { DriverMarketplace, GarageMarketplace } from './Marketplace.jsx';
import { durationLabel } from './marketplace.js';
import { TAB_AREAS } from './team.js';
import { FEEDBACK_KINDS } from './platform.js';
import { siteFlag } from './site.jsx';
import './dashboard.css';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const time = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`;
};
const defaultVehicle = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  registration: '',
  mileage: 0,
};
const vehicleFields = [
  {
    name: 'make',
    label: 'Make',
    required: true,
    maxLength: 60,
    suggest: true,
    placeholder: 'Start typing, e.g. Volvo',
  },
  {
    name: 'model',
    label: 'Model',
    required: true,
    maxLength: 60,
    suggest: true,
    placeholder: 'Choose a make first, then search',
  },
  {
    name: 'year',
    label: 'Year',
    type: 'number',
    min: 1900,
    max: new Date().getFullYear() + 1,
    required: true,
  },
  { name: 'registration', label: 'Registration', required: true, maxLength: 24 },
  { name: 'mileage', label: 'Mileage (km)', type: 'number', min: 0, max: 5000000, required: true },
];

export function FormDialog({ config, onClose, onSave }) {
  const ref = useRef(null),
    opener = useRef(document.activeElement);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [suggestions, setSuggestions] = useState({}),
    [preview, setPreview] = useState(null);

  async function suggest(e) {
    const input = e.target;
    if (!config.fields?.some((f) => f.suggest && f.name === input.name)) return;
    const q = encodeURIComponent(input.value),
      path =
        input.name === 'make'
          ? `/catalog/makes?q=${q}`
          : `/catalog/models?make=${encodeURIComponent(input.form.elements.make.value)}&q=${q}`;
    try {
      const list = await api(path);
      setSuggestions((s) => ({ ...s, [input.name]: list }));
    } catch {}
  }

  async function showCar(e) {
    const form = e.target.form;
    if (!form?.elements.make || !['make', 'model'].includes(e.target.name)) return;
    const make = form.elements.make.value.trim(),
      model = form.elements.model.value.trim();
    if (!make || !model) {
      setPreview(null);
      return;
    }
    try {
      setPreview(
        await api(
          `/catalog/image?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        ),
      );
    } catch {
      setPreview(null);
    }
  }
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => {
      d.close();
      opener.current?.focus();
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form);
    for (const field of config.fields || [])
      if (field.type === 'checkboxes') values[field.name] = form.getAll(field.name);
    try {
      if (config.fields?.some((field) => field.type === 'slots' && !values[field.name]))
        throw new Error('Choose an available appointment time before continuing.');
      await config.save(values);
      await onSave();
      onClose();
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="dash-dialog"
      aria-labelledby="dash-dialog-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="Close form"
        disabled={busy}
        onClick={onClose}
      >
        <XIcon size={21} />
      </button>
      <span className="eyebrow">MOTODOC</span>
      <h2 id="dash-dialog-title">{config.title}</h2>
      {config.note && <p className="dash-help">{config.note}</p>}
      {config.content}
      <form
        onSubmit={submit}
        onInput={suggest}
        onFocus={suggest}
        onBlur={showCar}
        onChange={showCar}
      >
        {(config.fields || []).map((f) =>
          f.type === 'slots' ? (
            <div className="dash-field" key={f.name}>
              {f.label}
              <span className="required"> *</span>
              <SlotPicker garageId={f.garageId} name={f.name} />
            </div>
          ) : f.type === 'checkboxes' ? (
            <fieldset className="dash-field dash-checks" key={f.name}>
              <legend>{f.label}</legend>
              {f.options.map((o) => (
                <label key={o.value}>
                  <input
                    type="checkbox"
                    name={f.name}
                    value={o.value}
                    defaultChecked={config.values?.[f.name]?.includes(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
          ) : (
            <label className="dash-field" key={f.name}>
              {f.label}
              {f.required && <span className="required"> *</span>}
              {f.options ? (
                <select
                  name={f.name}
                  required={f.required}
                  defaultValue={config.values?.[f.name] || ''}
                >
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  name={f.name}
                  required={f.required}
                  maxLength={f.maxLength || 2000}
                  defaultValue={config.values?.[f.name] || ''}
                  rows={3}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type || 'text'}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  maxLength={f.maxLength}
                  placeholder={f.placeholder}
                  autoComplete={f.suggest ? 'off' : undefined}
                  list={f.suggest ? `dash-${f.name}-options` : undefined}
                  defaultValue={config.values?.[f.name] ?? ''}
                />
              )}
              {f.suggest && (
                <datalist id={`dash-${f.name}-options`}>
                  {(suggestions[f.name] || []).map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              )}
            </label>
          ),
        )}
        {preview && <CarPicture vehicle={preview} className="dash-preview" />}
        {error && (
          <p role="alert" className="dash-error">
            {error}
          </p>
        )}
        <div className="dash-form-actions">
          <button type="button" className="dash-secondary" disabled={busy} onClick={onClose}>
            {config.cancel || 'Cancel'}
          </button>
          <button className="button button-small" disabled={busy}>
            {busy ? 'Saving…' : config.submit || 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function CarPicture({ vehicle, className = '' }) {
  const [failedSources, setFailedSources] = useState([]);
  const photo =
    siteFlag('md-no-photos') && vehicle.image_url && !failedSources.includes(vehicle.image_url)
      ? vehicle.image_url
      : null;
  const source = photo || `/api/catalog/art/${vehicle.body || 'car'}.svg`;
  return (
    <figure className={`dash-car ${className}`.trim()}>
      <div className={`dash-car-frame ${photo ? 'photo' : 'art'}`}>
        {failedSources.includes(source) ? (
          <div className="dash-car-fallback">
            <CarIcon size={64} aria-hidden="true" />
            <span>
              {vehicle.make} {vehicle.model}
            </span>
            <small>Vehicle image unavailable</small>
          </div>
        ) : (
          <img
            src={source}
            alt={`${vehicle.make} ${vehicle.model}, model image`}
            loading="lazy"
            onError={() => setFailedSources((current) => [...current, source])}
          />
        )}
      </div>
      {photo && vehicle.image_source && (
        <figcaption>
          <a href={vehicle.image_source} target="_blank" rel="noreferrer">
            Photo: {vehicle.image_credit}
            {vehicle.image_license && ` � ${vehicle.image_license}`}
          </a>
        </figcaption>
      )}
    </figure>
  );
}

function Avatar({ name, photo, className = '' }) {
  return photo ? (
    <img className={`dash-avatar ${className}`.trim()} src={photo} alt="" />
  ) : (
    <span className={`dash-avatar ${className}`.trim()}>{name.slice(0, 1).toUpperCase()}</span>
  );
}
function PhotoUpload({ user, onChange }) {
  const input = useRef(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(work, message) {
    setBusy(true);
    setError('');
    try {
      await work();
      await onChange(message);
    } catch (e) {
      const message = e.status ? e.message : 'That image could not be used. Try a JPG or PNG.';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }
  function choose(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    save(async () => {
      const bitmap = await createImageBitmap(file),
        side = Math.min(bitmap.width, bitmap.height),
        canvas = document.createElement('canvas'),
        context = canvas.getContext('2d');
      canvas.width = canvas.height = 160;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, 160, 160);
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        160,
        160,
      );
      await api('/account/photo', {
        method: 'PUT',
        body: { image: canvas.toDataURL('image/jpeg', 0.82) },
      });
    }, 'Photo updated.');
  }
  return (
    <div className="dash-photo">
      <Avatar name={user.name} photo={user.photo} className="large" />
      <div>
        <div className="dash-tile-actions">
          <button className="dash-secondary" disabled={busy} onClick={() => input.current.click()}>
            {busy ? 'Saving…' : user.photo ? 'Change photo' : 'Upload a photo'}
          </button>
          {user.photo && (
            <button
              className="dash-text-button muted"
              disabled={busy}
              onClick={() =>
                save(() => api('/account/photo', { method: 'DELETE', body: {} }), 'Photo removed.')
              }
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={choose}
        />
        {error && (
          <p role="alert" className="dash-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
function Empty({ icon: Icon = WrenchIcon, title, children, action }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-art" aria-hidden="true">
        <Icon size={34} weight="regular" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Skeleton() {
  return (
    <div className="dashboard" aria-busy="true">
      <aside className="dash-sidebar" data-fit>
        <Brand />
      </aside>
      <main className="dash-main">
        <p role="status" className="dash-visually-hidden">
          Loading your MotoDoc…
        </p>
        <div className="dash-skeleton header" />
        <div className="dash-stats">
          <div className="dash-skeleton stat" />
          <div className="dash-skeleton stat" />
          <div className="dash-skeleton stat" />
        </div>
        <div className="dash-skeleton list" />
      </main>
    </div>
  );
}
function MoreSheet({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const sheet = ref.current;
    sheet.showModal();
    return () => sheet.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dash-more"
      aria-label="More sections"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current || event.target.closest('a')) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function ConnectGoogle({ onLinked }) {
  const button = useRef(null),
    [clientId, setClientId] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api('/config')
      .then((c) => setClientId(c.googleClientId || ''))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!clientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            setError('');
            await api('/auth/link-google', {
              method: 'POST',
              body: { credential: response.credential },
            });
            onLinked();
          } catch (e) {
            setError(e.message);
          }
        },
      });
      if (button.current)
        window.google.accounts.id.renderButton(button.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 300,
        });
    };
    script.onerror = () => setError('Google Sign-In could not load. Try again later.');
    document.head.appendChild(script);
    return () => script.remove();
  }, [clientId, onLinked]);
  return (
    <div className="dash-google-link">
      {clientId === null ? (
        <p>Checking Google Sign-In…</p>
      ) : clientId ? (
        <div ref={button} />
      ) : (
        <p>Google sign-in will be available here when MotoDoc is connected to Google.</p>
      )}
      {error && (
        <p role="alert" className="dash-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Dashboard() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    document.title = 'Your account — MotoDoc';
  }, []);

  const [opening, setOpening] = useState(() => {
    if (!siteFlag('md-no-splash')) return false;
    try {
      return !sessionStorage.getItem('motodoc-opened');
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(
      () => {
        setOpening(false);
        try {
          sessionStorage.setItem('motodoc-opened', '1');
        } catch {}
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
    );
    return () => clearTimeout(timer);
  }, [opening]);
  const [more, setMore] = useState(false);
  const [tourOpen, setTourOpen] = useState(
    () => new URLSearchParams(location.search).get('from') === 'onboarding',
  );
  const [tourTarget, setTourTarget] = useState('');
  useEffect(() => {
    if (!notice) return;
    toast(notice);
    setNotice('');
  }, [notice]);
  const [user, setUser] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [view, setView] = useState(location.hash.slice(1) || 'overview'),
    [dialog, setDialog] = useState(null),
    [search, setSearch] = useState('');
  const isGarage = user?.role === 'garage';
  const isStaff = isGarage && user?.garageRole !== 'owner';
  const allowed = (area) => !isGarage || !!user?.permissions?.includes(area);
  const load = useCallback(async (account) => {
    const may = (area) => account.role !== 'garage' || account.permissions?.includes(area);
    const paths = [
      'overview',
      'bookings',
      'messages',
      'service-history',
      'plans',
      'memberships',
      ...(may('invoicing') ? ['invoices'] : []),
      'reminders',
      ...(account.role === 'garage'
        ? ['garage/profile', ...(may('customers') ? ['customers'] : [])]
        : ['vehicles', 'garages']),
    ];
    const results = await Promise.all(paths.map((p) => api('/' + p)));
    setData(Object.fromEntries(paths.map((p, i) => [p, results[i]])));
    setError('');
  }, []);
  useEffect(() => {
    let active = true;
    api('/auth/me')
      .then(async ({ user: u }) => {
        if (!active) return;
        if (!u.onboarded) return location.replace('/onboarding');
        setUser(u);
        if (u.suspended || ['paused', 'removed'].includes(u.teamStatus)) return;
        await load(u);
      })
      .catch((e) => {
        if (e.status === 401) location.replace('/login');
        else if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    const changed = () => {
      setView(location.hash.slice(1) || 'overview');
      setSearch('');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const reload = () => load(user);
  const open = (config) => setDialog(config);
  const navigate = (v) => {
    location.hash = v;
  };
  const nav = [
    ['overview', HouseIcon, 'Overview'],
    ...(isGarage
      ? [
          ['profile', StorefrontIcon, 'Garage profile'],
          ['services', WrenchIcon, 'Services'],
        ]
      : [
          ['vehicles', CarIcon, 'My vehicles'],
          ['garages', StorefrontIcon, 'Find a garage'],
        ]),
    ['bookings', CalendarBlankIcon, 'Bookings'],
    ['marketplace', LifebuoyIcon, 'Marketplace'],
    ...(isGarage ? [['jobs', ListChecksIcon, 'Jobs']] : []),
    ['history', ClockCounterClockwiseIcon, 'Service history'],
    ...(isGarage ? [['customers', UsersIcon, 'Customers']] : []),
    ['memberships', GiftIcon, 'Memberships'],
    ['invoices', ReceiptIcon, 'Invoices'],
    ...(isGarage ? [['analytics', ChartBarIcon, 'Analytics']] : []),
    ['reminders', BellIcon, 'Reminders'],
    ...(isGarage ? [['team', UsersThreeIcon, 'Team']] : []),
    ['account', LockKeyIcon, 'Account'],
  ].filter(([key]) => !isGarage || !TAB_AREAS[key] || allowed(TAB_AREAS[key]));
  const blocked = isGarage && !!TAB_AREAS[view] && !allowed(TAB_AREAS[view]);
  const selected = blocked ? 'no-access' : nav.some((n) => n[0] === view) ? view : 'overview';
  const quick = isGarage
    ? { overview: 'Overview', bookings: 'Bookings', customers: 'Customers', profile: 'Profile' }
    : { overview: 'Overview', vehicles: 'Vehicles', garages: 'Garages', bookings: 'Bookings' };
  const go = (target, label) => (
    <button className="button button-small" onClick={() => navigate(target)}>
      {label} <ArrowRightIcon size={16} />
    </button>
  );
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      flash('You have been signed out.');
      location.assign('/login');
    } catch (e) {
      setError(e.message);
    }
  };
  const act = (path, body, method = 'POST') => api(path, { method, body });
  function changeVehicle(v) {
    open({
      title: v ? 'Edit vehicle' : 'Add your vehicle',
      fields: vehicleFields,
      values: v || defaultVehicle,
      save: (d) =>
        act(
          v ? `/vehicles/${v.id}` : '/vehicles',
          { ...d, year: Number(d.year), mileage: Number(d.mileage) },
          v ? 'PATCH' : 'POST',
        ),
    });
  }
  function book(g) {
    if (!data.vehicles.length) {
      navigate('vehicles');
      return;
    }
    open({
      title: `Book ${g.name}`,
      note: 'Pick a free hour in your local time. The garage will confirm your request.',
      values: { vehicle_id: data.vehicles[0].id, service: g.services[0] },
      fields: [
        {
          name: 'vehicle_id',
          label: 'Vehicle',
          required: true,
          options: data.vehicles.map((v) => ({
            value: v.id,
            label: `${v.make} ${v.model} · ${v.registration}`,
          })),
        },
        {
          name: 'service',
          label: 'Service',
          required: true,
          options: (g.menu?.length ? g.menu : g.services.map((name) => ({ name }))).map((s) => ({
            value: s.name,
            label: s.id ? `${s.name} · ${priceText(s)} · ${durationText(s)}` : s.name,
          })),
        },
        {
          name: 'starts_at',
          label: 'Appointment',
          type: 'slots',
          garageId: g.id,
        },
        {
          name: 'notes',
          label: 'Anything the mechanic should know?',
          type: 'textarea',
          maxLength: 1000,
        },
      ],
      submit: 'Request booking',
      save: (d) => {
        if (!d.starts_at) throw new Error('Choose an appointment time.');
        return act('/bookings', { ...d, garage_id: g.id });
      },
    });
  }
  function profile() {
    const g = data['garage/profile'];
    open({
      title: 'Your garage profile',
      values: { ...g, services: g.services.join(', '), published: String(g.published) },
      fields: [
        { name: 'name', label: 'Garage name', required: true },
        { name: 'city', label: 'City', required: true },
        { name: 'address', label: 'Address', required: true },
        { name: 'description', label: 'About your garage', type: 'textarea', maxLength: 1500 },
        {
          name: 'published',
          label: 'Visibility',
          required: true,
          options: [
            { value: 'false', label: 'Draft — only you can see it' },
            { value: 'true', label: 'Listed in this MotoDoc app' },
          ],
        },
      ],
      save: (d) =>
        act(
          '/garage/profile',
          {
            ...d,
            services: g.services.length ? g.services : ['Oil change'],
            published: d.published === 'true',
          },
          'PUT',
        ),
    });
  }
  function workshop() {
    const g = data['garage/profile'];
    open({
      title: 'Workshop details',
      note: 'Shown on your garage card and invoices. Drivers can filter garages by specialisation.',
      values: {
        business_id: g.business_id,
        hourly_rate: g.hourly_rate ?? '',
        specializations: g.specializations,
        main_focus: g.main_focus,
      },
      fields: [
        {
          name: 'business_id',
          label: 'Business ID (Y-tunnus)',
          maxLength: 9,
          placeholder: '1234567-1',
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
          name: 'specializations',
          label: 'Specialisations',
          type: 'checkboxes',
          options: SPECIALIZATIONS.map(([value, label]) => ({ value, label })),
        },
        {
          name: 'main_focus',
          label: 'Your main focus',
          required: true,
          options: SPECIALIZATIONS.map(([value, label]) => ({ value, label })),
        },
      ],
      save: (d) =>
        act(
          '/garage/details',
          {
            business_id: d.business_id,
            hourly_rate: Number(d.hourly_rate),
            specializations: d.specializations,
            main_focus: d.main_focus,
          },
          'PUT',
        ),
    });
  }
  function contact() {
    const g = data['garage/profile'];
    open({
      title: 'Contact details',
      note: 'Shown to drivers who have a booking with your garage.',
      values: g,
      fields: [
        { name: 'mechanic_name', label: 'Mechanic drivers will meet', maxLength: 100 },
        { name: 'phone', label: 'Phone number', type: 'tel', maxLength: 30 },
      ],
      save: (d) => act('/garage/contact', d, 'PUT'),
    });
  }
  function messageBooking(b) {
    const thread = data.messages.filter((m) => m.booking_id === b.id);
    open({
      title: `Messages with ${isGarage ? b.driver_name : b.garage_name}`,
      note: `${b.service} · ${b.registration} · ${time(b.starts_at)}`,
      content: thread.length ? (
        <ul className="dash-thread">
          {thread.map((m) => (
            <li key={m.id} className={m.sender_id === user.id ? 'mine' : ''}>
              <Avatar name={m.sender_name} photo={m.sender_photo} className="small" />
              <p>{m.body}</p>
              <small>
                {m.sender_id === user.id ? 'You' : m.sender_name} · {time(m.created_at)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-help">No messages about this booking yet.</p>
      ),
      fields: [
        { name: 'body', label: 'Your message', type: 'textarea', required: true, maxLength: 2000 },
      ],
      submit: 'Send message',
      save: (d) => act(`/bookings/${b.id}/messages`, d),
    });
  }
  const quickAction = async (path, body, message) => {
    try {
      await act(path, body);
      await reload();
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const openDetails = (b) =>
    open({
      title: b.service,
      note: `${isGarage ? b.driver_name : b.garage_name} · ${b.make} ${b.model} · ${b.registration}`,
      content: <JobDetails booking={b} isGarage={isGarage} />,
      submit: 'Close',
      save: async () => {},
    });
  function scheduleForCustomer() {
    const choices = (data.customers || []).flatMap((c) =>
      (c.vehicles || []).map((v) => ({
        value: `${c.id}|${v.id}`,
        label: `${c.name} · ${v.make} ${v.model} · ${v.registration}`,
      })),
    );
    if (!choices.length) {
      toast(
        'Customers appear here after they book with you. Invite people who aren’t on MotoDoc yet.',
        'error',
      );
      return;
    }
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(9, 0, 0, 0);
    const services = data['garage/profile']?.services || [];
    open({
      title: 'Schedule an appointment',
      note: 'For a customer on MotoDoc. They get a request in the app and approve or decline it. It shows in your calendar as waiting for the customer until they approve it.',
      values: {
        customer: choices[0].value,
        service: services[0],
        starts_at: toLocalInput(tomorrow.toISOString()),
      },
      fields: [
        { name: 'customer', label: 'Customer and car', required: true, options: choices },
        {
          name: 'service',
          label: 'Service',
          required: true,
          options: services.map((x) => ({ value: x, label: x })),
        },
        {
          name: 'starts_at',
          label: 'Date and time',
          type: 'datetime-local',
          step: 3600,
          required: true,
        },
        { name: 'notes', label: 'Note for the customer', type: 'textarea', maxLength: 1000 },
      ],
      submit: 'Send to customer',
      save: ({ customer, starts_at, ...d }) => {
        const [driver_id, vehicle_id] = customer.split('|');
        const start = new Date(starts_at);
        start.setMinutes(0, 0, 0);
        return act('/bookings/schedule', {
          ...d,
          driver_id,
          vehicle_id,
          starts_at: start.toISOString(),
        });
      },
    });
  }
  const confirm = (title, note, path, body, method = 'PATCH') =>
    open({ title, note, submit: 'Confirm', save: () => act(path, body, method) });
  function rows(bookings) {
    return (
      <div className="dash-list">
        {bookings.map((b) => (
          <article className="dash-row" key={b.id}>
            <Avatar
              name={isGarage ? b.driver_name : b.garage_name}
              photo={isGarage ? b.driver_photo : b.garage_photo}
              className="row"
            />
            <div className="dash-row-body">
              <div className="dash-row-title">
                <h3>{b.service}</h3>
                <JobStatus booking={b} isGarage={isGarage} />
                {b.source === 'marketplace' && b.quote_cents != null && (
                  <span className="mk-pill strong">
                    {`Agreed quote ${euro(b.quote_cents)} · ${durationLabel(b.quote_minutes)}`}
                  </span>
                )}
              </div>
              <p>
                {isGarage ? b.driver_name : b.garage_name} · {b.make} {b.model} · {b.registration}
              </p>
              <p>
                {time(b.starts_at)}
                {b.notes && ` · ${b.notes}`}
              </p>
            </div>
            <div className="dash-row-actions">
              {jobActions(b, {
                isGarage,
                open,
                act,
                quick: quickAction,
                details: () => openDetails(b),
                rebook: () => navigate('garages'),
              }).map(([label, onClick, tone]) => (
                <button
                  key={label}
                  className={`dash-text-button${tone === 'danger' ? ' muted' : ''}${tone === 'primary' ? ' strong' : ''}`}
                  onClick={onClick}
                >
                  {label}
                </button>
              ))}
              <button
                className="dash-text-button"
                onClick={() => messageBooking(b)}
                disabled={!b.chat_open}
                title={b.chat_open ? undefined : 'Chat closed 24 hours after the repair'}
              >
                <ChatCircleIcon size={16} /> {b.chat_open ? 'Messages' : 'Chat closed'}
                {b.chat_open &&
                  data.messages.some((m) => m.booking_id === b.id) &&
                  ` (${data.messages.filter((m) => m.booking_id === b.id).length})`}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (user && (user.suspended || ['paused', 'removed'].includes(user.teamStatus)))
    return <TeamGate user={user} onLogout={logout} />;
  if (!user || !data) {
    if (error || !loading)
      return (
        <main className="dash-fault">
          <Empty
            icon={WarningCircleIcon}
            title="MotoDoc could not open"
            action={
              <button className="button button-small" onClick={() => location.reload()}>
                Try again
              </button>
            }
          >
            {error || 'Your account could not be loaded.'}
          </Empty>
          <a href="/login">Return to login</a>
        </main>
      );
    if (!opening) return <Skeleton />;
  }
  if (opening)
    return (
      <main className="md-splash">
        <div className="md-splash-logo">
          <img src="/assets/motodoc-logo.svg" alt="" />
        </div>
        <p className="md-splash-name">MotoDoc</p>
        <div className="md-splash-pixels" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <p role="status" className="md-splash-status">
          Opening your MotoDoc…
        </p>
      </main>
    );
  return (
    <div className="dashboard">
      <aside className="dash-sidebar" data-fit>
        <Brand />
        <span className="dash-role">
          {isStaff ? 'GARAGE TEAM' : isGarage ? 'FOR GARAGES' : 'FOR DRIVERS'}
        </span>
        <nav aria-label="Account navigation">
          {nav.map(([key, Icon, label]) => (
            <a
              href={`#${key}`}
              className={selected === key ? 'active' : ''}
              aria-current={selected === key ? 'page' : undefined}
              key={key}
              data-tour-active={tourTarget === key ? 'true' : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
            </a>
          ))}
          {!isGarage && (
            <a href="/dashboard">
              <GaugeIcon size={20} />
              <span>Car dashboard</span>
            </a>
          )}
        </nav>
        <div className="dash-account">
          <span data-lang-switch />
          <Bell />
          <Avatar name={user.name} photo={user.photo} />
          <ThemeToggle />
          {!isStaff && (
            <button
              type="button"
              className="icon-button"
              aria-label="Start guided tour"
              onClick={() => setTourOpen(true)}
            >
              <QuestionIcon size={20} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Leave feedback"
            title="Leave feedback"
            onClick={() =>
              open({
                silent: true,
                title: 'Leave feedback',
                note: 'Report a problem or share an idea. The MotoDoc team reads every message.',
                values: { kind: 'problem' },
                fields: [
                  {
                    name: 'kind',
                    label: 'What is it about?',
                    required: true,
                    options: FEEDBACK_KINDS.map(([value, label]) => ({ value, label })),
                  },
                  {
                    name: 'message',
                    label: 'Message',
                    type: 'textarea',
                    required: true,
                    maxLength: 2000,
                  },
                ],
                submit: 'Send feedback',
                save: async (d) => {
                  await api('/feedback', { method: 'POST', body: { ...d, page: `#${selected}` } });
                  toast('Thanks! Your feedback reached the MotoDoc team.');
                },
              })
            }
          >
            <ChatTextIcon size={20} />
          </button>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button
            aria-label="Log out"
            className="icon-button"
            onClick={async () => {
              try {
                await act('/auth/logout', {});
                flash('You have been signed out.');
                location.assign('/login');
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <SignOutIcon size={20} />
          </button>
        </div>
      </aside>
      <main className="dash-main" key={selected}>
        {user.demo && <DemoBar persona={user.demo} />}
        <header className="dash-page-header">
          <div>
            <span className="eyebrow">YOUR MOTODOC</span>
            <h1>
              {selected === 'overview'
                ? `Hello, ${user.name.split(' ')[0]}.`
                : nav.find((n) => n[0] === selected)?.[2] || 'No access'}
            </h1>
            <p>
              {selected === 'overview'
                ? isGarage
                  ? 'A clear view of your garage, and the people who trust it.'
                  : 'Your car care, clearly organised.'
                : selected === 'bookings'
                  ? 'From your next appointment to the last repair.'
                  : selected === 'memberships'
                    ? 'Good things from a garage you know.'
                    : selected === 'invoices'
                      ? 'Your service costs, all in one place.'
                      : selected === 'reminders'
                        ? 'A little help remembering what’s next.'
                        : selected === 'marketplace'
                          ? 'Emergency help from nearby garages, with prices up front.'
                          : selected === 'team'
                            ? 'Who works with you, and what each person can see and do.'
                            : selected === 'no-access'
                              ? 'This part of the garage account isn’t shared with you.'
                              : 'Keep the details that matter together.'}
            </p>
          </div>
          <span className="dash-connected">
            <span /> Connected
          </span>
        </header>
        {error && (
          <div role="alert" className="dash-error">
            {error}
            <button
              className="dash-text-button"
              onClick={() => reload().catch((e) => setError(e.message))}
            >
              Try again
            </button>
          </div>
        )}

        {selected === 'overview' && (
          <>
            {isGarage && <AvailabilityCard canEdit={allowed('bookings')} />}
            <div className="dash-stats">
              {[
                [CalendarBlankIcon, 'Upcoming bookings', data.overview.upcoming],
                [CheckCircleIcon, 'Services completed', data.overview.completed],
                isGarage && !allowed('invoicing')
                  ? allowed('customers')
                    ? [UsersIcon, 'Customers', data.customers.length]
                    : [ChatCircleIcon, 'Messages', data.messages.length]
                  : [
                      ReceiptIcon,
                      isGarage ? 'Awaiting payment' : 'Outstanding invoices',
                      euro(data.overview.invoiceTotals.unpaid),
                    ],
              ].map(([Icon, label, value]) => (
                <article key={label}>
                  <Icon size={23} />
                  <p>{label}</p>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className="dash-section-heading">
              <h2>Your bookings</h2>
              <button className="dash-text-button" onClick={() => navigate('bookings')}>
                View all <ArrowRightIcon size={16} />
              </button>
            </div>
            {data.overview.recentBookings.length ? (
              rows(data.overview.recentBookings)
            ) : (
              <Empty
                icon={CalendarBlankIcon}
                title={isGarage ? 'Ready for your first booking' : 'Let’s get your car connected'}
                action={
                  <button
                    className="button button-small"
                    onClick={() =>
                      isGarage
                        ? profile()
                        : data.vehicles.length
                          ? navigate('garages')
                          : changeVehicle()
                    }
                  >
                    {isGarage
                      ? 'Set up your garage'
                      : data.vehicles.length
                        ? 'Find a garage'
                        : 'Add your first vehicle'}{' '}
                    <ArrowRightIcon size={16} />
                  </button>
                }
              >
                {isGarage
                  ? 'Complete your garage profile and list your services so drivers can find you.'
                  : 'Add your vehicle, find a garage, and book your next service.'}
              </Empty>
            )}
            <div className="dash-overview-note">
              <WrenchIcon size={25} />
              <div>
                <h3>
                  {isGarage
                    ? 'More time for what you do best.'
                    : 'A familiar face for every service.'}
                </h3>
                <p>
                  {isGarage && !allowed('invoicing')
                    ? 'Your jobs, customers and messages, all in one place.'
                    : isGarage
                      ? `Payments recorded as received: ${euro(data.overview.invoiceTotals.paid)}. These are your recorded payments, not processed transactions.`
                      : 'Bookings, records, and reminders stay together in your MotoDoc account.'}
                </p>
              </div>
            </div>
          </>
        )}

        {selected === 'vehicles' && (
          <>
            <div className="dash-section-heading">
              <h2>
                {data.vehicles.length} {data.vehicles.length === 1 ? 'vehicle' : 'vehicles'}
              </h2>
              <button className="button button-small" onClick={() => changeVehicle()}>
                <PlusIcon size={17} /> Add vehicle
              </button>
            </div>
            {data.vehicles.length ? (
              <div className="dash-grid">
                {data.vehicles.map((v) => (
                  <article className="dash-tile" key={v.id}>
                    <span className="dash-plate">{v.registration}</span>
                    <CarPicture vehicle={v} />
                    <h3>
                      {v.make} {v.model}
                    </h3>
                    <p>
                      {v.year} · {v.mileage.toLocaleString()} km
                    </p>
                    <div className="dash-tile-actions">
                      <button className="dash-text-button" onClick={() => changeVehicle(v)}>
                        Edit details
                      </button>
                      <button
                        className="dash-text-button muted"
                        onClick={() =>
                          confirm(
                            'Remove vehicle',
                            `${v.make} ${v.model} · ${v.registration}. Vehicles with booking history are kept for your records.`,
                            `/vehicles/${v.id}`,
                            {},
                            'DELETE',
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={CarIcon}
                title="Your garage starts here"
                action={
                  <button className="button button-small" onClick={() => changeVehicle()}>
                    Add your first vehicle <ArrowRightIcon size={16} />
                  </button>
                }
              >
                Add your first car to keep its details and service records together.
              </Empty>
            )}
          </>
        )}

        {selected === 'garages' && (
          <>
            <label className="dash-search">
              Search garages
              <input
                type="search"
                placeholder="Garage name, city, or service"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {data.garages.filter((g) =>
              `${g.name} ${g.city} ${g.services.join(' ')} ${(g.specializations || []).map(specLabel).join(' ')}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ).length ? (
              <div className="dash-grid">
                {data.garages
                  .filter((g) =>
                    `${g.name} ${g.city} ${g.services.join(' ')} ${(g.specializations || []).map(specLabel).join(' ')}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((g) => (
                    <article className="dash-tile" key={g.id}>
                      <StorefrontIcon size={29} />
                      <h3>{g.name}</h3>
                      {g.verification === 'verified' && (
                        <span className="gt-pill open gt-verified">Verified by MotoDoc</span>
                      )}
                      {g.review_count > 0 && (
                        <span className="dash-rating">
                          <StarIcon size={13} weight="fill" />
                          <b>{g.rating.toFixed(1)}</b> · {g.review_count} verified{' '}
                          {g.review_count === 1 ? 'review' : 'reviews'}
                        </span>
                      )}
                      <p>
                        {g.address}, {g.city}
                      </p>
                      <p>{g.description}</p>
                      <div className="gt-garage-meta">
                        <span className={`gt-pill ${g.open_now && g.online ? 'open' : ''}`}>
                          {!g.online
                            ? 'Not taking bookings'
                            : g.open_now
                              ? 'Open now'
                              : 'Closed now'}
                        </span>
                        {g.hourly_rate && <span>{`€${g.hourly_rate}/h`}</span>}
                        {g.member_rate && (
                          <span className="gt-member-rate">{`Member €${g.member_rate}/h`}</span>
                        )}
                      </div>
                      {g.specializations?.length > 0 && (
                        <div className="dash-chips gt-specs">
                          {[g.main_focus, ...g.specializations.filter((k) => k !== g.main_focus)]
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((k) => (
                              <span key={k}>{specLabel(k)}</span>
                            ))}
                        </div>
                      )}
                      <div className="dash-chips">
                        {(g.menu?.length ? g.menu : g.services.map((name) => ({ name }))).map(
                          (s) => (
                            <span key={s.name}>
                              {s.id ? `${s.name} · ${priceText(s)}` : s.name}
                            </span>
                          ),
                        )}
                      </div>
                      <button className="button button-small" onClick={() => book(g)}>
                        {data.vehicles.length ? 'Book a service' : 'Add a vehicle to book'}{' '}
                        <ArrowRightIcon size={16} />
                      </button>
                    </article>
                  ))}
              </div>
            ) : (
              <Empty
                icon={StorefrontIcon}
                title={search ? 'No matching garages' : 'No garages listed yet'}
                action={
                  search && (
                    <button className="button button-small" onClick={() => setSearch('')}>
                      Show all garages
                    </button>
                  )
                }
              >
                {search
                  ? 'Try a different name or service.'
                  : 'Garage owners can create an account and publish their profile in this local app.'}
              </Empty>
            )}
          </>
        )}

        {selected === 'services' && <ServicesPanel open={open} canEdit={allowed('services')} />}
        {selected === 'team' && <TeamPanel open={open} user={user} />}
        {selected === 'marketplace' &&
          (isGarage ? (
            <GarageMarketplace open={open} data={data} />
          ) : (
            <DriverMarketplace data={data} user={user} open={open} reload={reload} />
          ))}
        {selected === 'no-access' && <NoAccess />}

        {selected === 'analytics' && <AnalyticsPanel data={data} />}

        {selected === 'jobs' &&
          (() => {
            const groups = [
              ['confirmed', 'Booked'],
              ['in_progress', 'Started'],
              ['finished', 'Finished'],
              ['ready', 'Ready for pickup'],
            ].map(([state, label]) => [
              label,
              data.bookings
                .filter((b) => b.state === state)
                .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1)),
            ]);
            const active = groups.slice(0, 3).reduce((n, [, list]) => n + list.length, 0);
            return (
              <>
                <div className="dash-stats">
                  {[
                    ['Active jobs', active],
                    ...groups.map(([label, list]) => [label, list.length]),
                  ].map(([label, value]) => (
                    <article key={label}>
                      <p>{label}</p>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                {groups.some(([, list]) => list.length) ? (
                  groups
                    .filter(([, list]) => list.length)
                    .map(([label, list]) => (
                      <section key={label}>
                        <h3 className="dash-subheading">{label}</h3>
                        {rows(list)}
                      </section>
                    ))
                ) : (
                  <Empty
                    icon={ListChecksIcon}
                    title="No approved jobs yet"
                    action={go('bookings', 'Go to bookings')}
                  >
                    Approve a booking request to start one.
                  </Empty>
                )}
              </>
            );
          })()}

        {selected === 'profile' && (
          <>
            <div className="dash-section-heading">
              <h2>Your public profile</h2>
              <button className="button button-small" onClick={profile}>
                Edit profile
              </button>
            </div>
            <article className="dash-tile dash-profile">
              <StorefrontIcon size={38} />
              <Status>{data['garage/profile'].published ? 'listed' : 'draft'}</Status>
              <h2>{data['garage/profile'].name}</h2>
              <p>
                {data['garage/profile'].address || 'Add your address'} ·{' '}
                {data['garage/profile'].city || 'Add your city'}
              </p>
              <p>{data['garage/profile'].description || 'Tell drivers about your garage.'}</p>
              <div className="dash-chips">
                {data['garage/profile'].services.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <h3>Workshop details</h3>
              <p>
                {[
                  data['garage/profile'].business_id &&
                    `Business ID ${data['garage/profile'].business_id}`,
                  data['garage/profile'].hourly_rate && `€${data['garage/profile'].hourly_rate}/h`,
                  data['garage/profile'].member_rate &&
                    `Member €${data['garage/profile'].member_rate}/h`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Add your Business ID and hourly rate.'}
              </p>
              <div className="dash-chips gt-specs">
                {[
                  data['garage/profile'].main_focus,
                  ...(data['garage/profile'].specializations || []).filter(
                    (k) => k !== data['garage/profile'].main_focus,
                  ),
                ]
                  .filter(Boolean)
                  .map((k) => (
                    <span key={k}>{specLabel(k)}</span>
                  ))}
              </div>
              <button className="dash-text-button" onClick={workshop}>
                Edit workshop details
              </button>
              <h3>Contact details</h3>
              <p>
                {[data['garage/profile'].mechanic_name, data['garage/profile'].phone]
                  .filter(Boolean)
                  .join(' · ') || 'Add a phone number and the mechanic drivers will meet.'}
              </p>
              <button className="dash-text-button" onClick={contact}>
                Edit contact details
              </button>
              <p className="dash-help">
                Listing your profile makes it visible to drivers. They can book free hours inside
                your opening hours, which you set on the Overview page.
              </p>
            </article>
          </>
        )}

        {selected === 'bookings' && (
          <>
            <div className="dash-section-heading">
              <h2>{isGarage ? 'Bookings & appointments' : 'All appointments'}</h2>
              {isGarage ? (
                <button className="button button-small" onClick={scheduleForCustomer}>
                  Schedule appointment <PlusIcon size={16} />
                </button>
              ) : (
                <button className="button button-small" onClick={() => navigate('garages')}>
                  Book a service <PlusIcon size={16} />
                </button>
              )}
            </div>
            {isGarage && data.bookings.some((b) => b.state === 'waiting') && (
              <>
                <h3 className="dash-subheading">
                  {`Incoming requests (${data.bookings.filter((b) => b.state === 'waiting').length})`}
                </h3>
                {rows(data.bookings.filter((b) => b.state === 'waiting'))}
                <h3 className="dash-subheading">Appointments</h3>
              </>
            )}
            {!isGarage &&
              data.bookings.some((b) => b.state === 'needs_approval' || b.review_due) && (
                <>
                  <h3 className="dash-subheading">Needs your action</h3>
                  {rows(data.bookings.filter((b) => b.state === 'needs_approval' || b.review_due))}
                  <h3 className="dash-subheading">All appointments</h3>
                </>
              )}
            {data.bookings.length ? (
              rows(
                isGarage
                  ? data.bookings.filter((b) => b.state !== 'waiting')
                  : data.bookings.filter((b) => b.state !== 'needs_approval' && !b.review_due),
              )
            ) : (
              <Empty
                icon={CalendarBlankIcon}
                title="No bookings yet"
                action={
                  isGarage
                    ? go('profile', 'Check your public profile')
                    : go('garages', 'Find a garage')
                }
              >
                Your service requests and confirmations will appear here.
              </Empty>
            )}
          </>
        )}

        {selected === 'history' &&
          (data['service-history'].length ? (
            <div className="dash-list">
              {data['service-history'].map((r) => (
                <article className="dash-row" key={r.id}>
                  <div className="dash-row-icon">
                    <CheckCircleIcon size={24} />
                  </div>
                  <div className="dash-row-body">
                    <h3>{r.service}</h3>
                    <p>
                      {r.garage_name} · {r.registration} · {date(r.performed_at)}
                    </p>
                    <p>{r.summary}</p>
                    <small>{r.mileage.toLocaleString()} km</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={ClockCounterClockwiseIcon}
              title="Every service tells a story"
              action={isGarage ? go('bookings', 'View bookings') : go('garages', 'Book a service')}
            >
              When a garage completes a booking, its service record appears here automatically.
            </Empty>
          ))}

        {selected === 'customers' &&
          (data.customers.length ? (
            <div className="dash-list">
              {data.customers.map((c) => (
                <article className="dash-row" key={c.id}>
                  <Avatar name={c.name} photo={c.photo} className="row" />
                  <div className="dash-row-body">
                    <h3>{c.name}</h3>
                    <p>
                      {c.email} · {c.booking_count} bookings
                    </p>
                    {c.tags && <small>{c.tags}</small>}
                    {c.notes && <p>{c.notes}</p>}
                  </div>
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
                    Edit notes
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={UsersIcon}
              title="Your customers, connected"
              action={go('profile', 'Check your public profile')}
            >
              Drivers who book with your garage will appear here.
            </Empty>
          ))}

        {selected === 'memberships' &&
          (isGarage ? (
            <GarageMemberships data={data} open={open} user={user} />
          ) : (
            <DriverMemberships data={data} open={open} navigate={navigate} reload={reload} />
          ))}

        {selected === 'invoices' && (
          <InvoicesPanel
            invoices={data.invoices}
            bookings={data.bookings}
            isGarage={isGarage}
            reload={reload}
          />
        )}

        {selected === 'reminders' && (
          <>
            <div className="dash-section-heading">
              <h2>Your reminders</h2>
              <button
                className="button button-small"
                onClick={() =>
                  open({
                    title: 'Add a reminder',
                    note: 'Reminders appear in your account. Email and push notifications are not connected.',
                    fields: [
                      {
                        name: 'title',
                        label: 'What would you like to remember?',
                        required: true,
                        maxLength: 160,
                      },
                      { name: 'due_date', label: 'Date', type: 'date', required: true },
                    ],
                    save: (d) => act('/reminders', d),
                  })
                }
              >
                Add reminder <PlusIcon size={16} />
              </button>
            </div>
            {data.reminders.length ? (
              <div className="dash-list">
                {data.reminders.map((r) => (
                  <article className="dash-row" key={r.id}>
                    <div className="dash-row-icon">
                      <BellIcon size={23} />
                    </div>
                    <div className="dash-row-body">
                      <h3>{r.title}</h3>
                      <p>{date(r.due_date)}</p>
                      <Status>
                        {r.done
                          ? 'done'
                          : new Date(r.due_date) < new Date(new Date().toDateString())
                            ? 'overdue'
                            : 'upcoming'}
                      </Status>
                    </div>
                    <button
                      className="dash-text-button"
                      onClick={() =>
                        confirm(
                          r.done ? 'Reopen reminder' : 'Complete reminder',
                          r.title,
                          `/reminders/${r.id}`,
                          { done: !r.done },
                        )
                      }
                    >
                      {r.done ? 'Reopen' : 'Mark done'}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <Empty icon={BellIcon} title="One less thing to remember">
                Add inspection dates, insurance renewals, or your next tyre change.
              </Empty>
            )}
          </>
        )}
        {selected === 'account' && (
          <article className="dash-tile dash-account-settings">
            <LockKeyIcon size={30} />
            <h2>Your account</h2>
            <p>
              {user.name} · {user.email}
            </p>
            <h3>{isGarage ? 'Garage photo or logo' : 'Profile photo'}</h3>
            <p>
              {isGarage
                ? 'Shown to drivers on their workshop card and in messages.'
                : 'Shown to garages you book with and in messages.'}
            </p>
            <PhotoUpload
              user={user}
              onChange={async (message) => {
                const result = await api('/auth/me');
                setUser(result.user);
                await load(result.user);
                setNotice(message);
              }}
            />
            <h3>Google Sign-In</h3>
            {user.googleLinked ? (
              <p>Connected. You can use Google to sign in to this account.</p>
            ) : (
              <>
                <p>
                  Connect the Google account with the same email address to use it for future
                  sign-ins.
                </p>
                <ConnectGoogle
                  onLinked={async () => {
                    const result = await api('/auth/me');
                    setUser(result.user);
                    setNotice('Google Sign-In connected to your account.');
                  }}
                />
              </>
            )}
          </article>
        )}
        {selected === 'account' && (
          <AccountSettings
            user={user}
            onSaved={async () => {
              const result = await api('/auth/me');
              setUser(result.user);
            }}
          />
        )}
      </main>
      <nav className="dash-bottom-nav" aria-label="Quick navigation">
        {nav
          .filter(([key]) => quick[key])
          .map(([key, Icon]) => (
            <a href={`#${key}`} aria-current={selected === key ? 'page' : undefined} key={key}>
              <Icon size={22} />
              <span>{quick[key]}</span>
            </a>
          ))}
        <button
          aria-haspopup="dialog"
          aria-current={quick[selected] ? undefined : 'page'}
          onClick={() => setMore(true)}
        >
          <DotsThreeIcon size={22} weight="bold" />
          <span>More</span>
        </button>
      </nav>
      {more && (
        <MoreSheet onClose={() => setMore(false)}>
          {nav
            .filter(([key]) => !quick[key])
            .map(([key, Icon, label]) => (
              <a href={`#${key}`} aria-current={selected === key ? 'page' : undefined} key={key}>
                <Icon size={21} />
                {label}
              </a>
            ))}
          {!isGarage && (
            <a href="/dashboard">
              <GaugeIcon size={21} />
              Car dashboard
            </a>
          )}
          <button onClick={logout}>
            <SignOutIcon size={21} />
            Log out
          </button>
        </MoreSheet>
      )}
      {tourOpen && !isStaff && (
        <GuidedTour
          role={user.role}
          onTarget={setTourTarget}
          onClose={() => {
            setTourOpen(false);
            history.replaceState(null, '', `${location.pathname}${location.hash}`);
          }}
        />
      )}
      {dialog && (
        <FormDialog
          config={dialog}
          onClose={() => setDialog(null)}
          onSave={async () => {
            await reload();
            if (!dialog.silent) setNotice('Saved to your MotoDoc account.');
          }}
        />
      )}
    </div>
  );
}
