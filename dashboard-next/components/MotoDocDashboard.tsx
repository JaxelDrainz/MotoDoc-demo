'use client';

import Image from 'next/image';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import PixelFill, { usePixelFill } from './PixelFill';
import { CalendarDays, CalendarPlus, CarFront, Check, ChevronDown, Clock3, Gauge, History, LogOut, MapPin, MessageSquare, Phone, Settings, Star, Store, X } from 'lucide-react';

export interface Vehicle {
  id: string;
  name: string;
  registration: string;
  mileage: number;
  /** Readings the driver has recorded; null until they do. */
  oilLife: number | null;
  brakeWear: number | null;
  motDue: string | null;
  motDays: number | null;
  /** A studio shot or photo of the model, or the SVG drawing for its body type. */
  imageSrc?: string;
  /** Present for photos that must be credited to their author. */
  imageCredit?: { label: string; href: string };
}

export interface Workshop {
  name: string;
  address: string;
  mechanicName: string;
  openingHours: string;
  phoneNumber: string;
  /** Average of verified reviews; null until the garage has one. */
  rating: number | null;
  reviewCount: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  vehicleId: string;
  title: string;
  /** ISO 8601 instant. */
  startsAt: string;
  durationMinutes: number;
  status: BookingStatus;
  workshop: Workshop;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  bookingId: string;
  /** The driver's own rating of this service, if given. */
  rating: number | null;
  title: string;
  summary: string;
  date: string;
  mileage: number;
  workshopName: string;
}

export interface Message {
  id: string;
  bookingId: string;
  senderName: string;
  mine: boolean;
  body: string;
  sentAt: string;
}

export interface Condition {
  oilLife: number | null;
  brakeWear: number | null;
  motDue: string | null;
}

export interface MotoDocDashboardProps {
  account: { name: string; email: string };
  vehicles: readonly Vehicle[];
  bookings: readonly Booking[];
  serviceHistory: readonly ServiceRecord[];
  messages: readonly Message[];
  logoSrc: string;
  /** The MotoDoc account area, where vehicles are added and garages are booked. */
  appHref: string;
  onReschedule: (bookingId: string, startsAt: string) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onSendMessage: (bookingId: string, body: string) => Promise<void>;
  onSaveCondition: (vehicleId: string, condition: Condition) => Promise<void>;
  onRateService: (bookingId: string, rating: number) => Promise<void>;
  onLogOut: () => Promise<void>;
}

const tabs = ['Overview', 'Service History', 'Bookings'] as const;
type Tab = typeof tabs[number];
type DialogKind = 'manage' | 'message' | 'call' | 'profile' | 'condition' | null;
const outlineButton = 'md-action inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#087658] px-3.5 py-2 text-sm font-medium text-[#087658] transition-colors hover:bg-[#eaf6f0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087658] disabled:cursor-wait disabled:opacity-60';
const field = 'mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal focus:outline-[#087658]';
const number = new Intl.NumberFormat('en-GB');
const statusLabel: Record<BookingStatus, string> = { pending: 'Awaiting garage confirmation', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };
const isActive = (booking: Booking) => booking.status === 'pending' || booking.status === 'confirmed';

function bookingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', options).format(date);
  return `${part({ weekday: 'long' })}, ${part({ day: 'numeric', month: 'short' })} · ${part({ hour: '2-digit', minute: '2-digit' })}`;
}

/** Value for a datetime-local input, in the browser's time zone. */
function localInput(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function escapeCalendar(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function downloadCalendar(booking: Booking): void {
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + booking.durationMinutes * 60000);
  const stamp = (date: Date) => `${date.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 15)}Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MotoDoc//Service booking//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${booking.id}@motodoc`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeCalendar(booking.title)}`,
    `LOCATION:${escapeCalendar([booking.workshop.name, booking.workshop.address].filter(Boolean).join(', '))}`,
    `STATUS:${booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'motodoc-service.ics';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Metric({ label, value, progress }: { label: string; value: string; progress: number | null }) {
  const percentage = Math.round(Math.max(0, Math.min(100, progress ?? 0)));
  return <div className="md-reading">
    <div className="mb-1 flex items-center justify-between gap-4 text-[16px] leading-6"><span>{label}</span><span className={progress === null ? 'text-[#626a72]' : 'tabular-nums'}>{value}</span></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={value} className="h-[5px] overflow-hidden rounded-full bg-[#dcece5]">
      <div className="md-reading-fill h-full rounded-full bg-[#0b7b5b]" style={{ width: `${percentage}%` }} />
    </div>
  </div>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const pixels = usePixelFill();
  return <section {...pixels.handlers} className="md-service-card relative min-w-0 overflow-hidden rounded-xl border border-[#d7dce0] bg-white p-6 sm:p-[30px]">
    <PixelFill active={pixels.active} />
    <div className="relative flex min-w-0 flex-col">
      <h2 className="mb-3.5 text-[23px] font-semibold leading-8 tracking-[-0.035em]">{title}</h2>{children}
    </div>
  </section>;
}

function Initial({ name, size }: { name: string; size: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.45 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#087658] font-semibold uppercase text-white">{name.trim().slice(0, 1) || '?'}</span>;
}

function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="flex items-start gap-4 py-2"><span className="mt-1 text-[#087658]">{icon}</span><div><p className="font-medium">{title}</p><div className="mt-1 text-sm leading-6 text-slate-600">{children}</div></div></div>;
}

export default function MotoDocDashboard({
  account, vehicles, bookings, serviceHistory, messages, logoSrc, appHref,
  onReschedule, onCancelBooking, onSendMessage, onSaveCondition, onRateService, onLogOut,
}: MotoDocDashboardProps) {
  const [selectedId, setSelectedId] = useState(vehicles[0]?.id);
  const [tab, setTab] = useState<Tab>('Overview');
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [targetId, setTargetId] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [openedAt] = useState(() => Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const heroPixels = usePixelFill();
  const dialogTitle = useId();
  const tabId = useId();

  const vehicle = vehicles.find(item => item.id === selectedId) ?? vehicles[0];
  const records = serviceHistory.filter(record => record.vehicleId === vehicle?.id);
  const vehicleBookings = bookings.filter(item => item.vehicleId === vehicle?.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const active = vehicleBookings.filter(isActive).reverse();
  const upcoming = active.find(item => new Date(item.startsAt).getTime() >= openedAt) ?? active.at(-1);
  /** The garage this vehicle is, or was most recently, booked with. */
  const workshopBooking = upcoming ?? vehicleBookings[0];
  const target = bookings.find(item => item.id === targetId);
  const thread = messages.filter(item => item.bookingId === targetId);

  function openDialog(kind: Exclude<DialogKind, null>, booking?: Booking) {
    setError(''); setConfirmingCancel(false);
    if (booking) { setTargetId(booking.id); setDraftDate(localInput(booking.startsAt)); }
    setDialogKind(kind);
    dialog.current?.showModal();
  }
  function closeDialog() { dialog.current?.close(); setDialogKind(null); }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next]);
    document.getElementById(`${tabId}-${next}`)?.focus();
  }
  async function run(action: () => Promise<void>, done: string, keepOpen = false) {
    setBusy(true); setError('');
    try { await action(); if (!keepOpen) closeDialog(); setNotice(done); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = new Date(draftDate);
    if (Number.isNaN(startsAt.getTime())) { setError('Choose a valid date and time.'); return; }
    void run(() => onReschedule(targetId, startsAt.toISOString()), 'Booking moved. Your garage will confirm the new time.');
  }
  function saveMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => { await onSendMessage(targetId, message.trim()); setMessage(''); }, 'Message sent to your garage.', true);
  }
  function saveCondition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicle) return;
    const values = new FormData(event.currentTarget);
    const reading = (name: string) => values.get(name) === '' ? null : Number(values.get(name));
    void run(() => onSaveCondition(vehicle.id, { oilLife: reading('oilLife'), brakeWear: reading('brakeWear'), motDue: String(values.get('motDue')) || null }), 'Vehicle readings saved.');
  }

  const bookingActions = (booking: Booking) => <div className="flex flex-wrap gap-2.5">
    <button className={outlineButton} onClick={() => { downloadCalendar(booking); setNotice('Calendar file downloaded. Open it to add your service.'); }}><CalendarDays size={17} aria-hidden="true" />Add to Calendar</button>
    <button className={outlineButton} onClick={() => openDialog('manage', booking)}><Settings size={17} aria-hidden="true" />Manage</button>
  </div>;
  const bookService = <a className={outlineButton} href={`${appHref}#garages`}><CalendarPlus size={17} aria-hidden="true" />Book a service</a>;
  const motValue = vehicle?.motDays == null ? 'Not recorded' : vehicle.motDays < 0 ? 'Overdue' : `${vehicle.motDays} ${vehicle.motDays === 1 ? 'day' : 'days'}`;

  return <div className="md-connected min-h-screen bg-[#f4f8fa] text-[#111827]">
    <header className="sticky top-0 z-30 border-b border-[#dce1e5] bg-white">
      <div className="mx-auto flex min-h-[90px] max-w-[1116px] flex-wrap items-center gap-x-8 gap-y-4 px-5 py-5 min-[1180px]:px-0">
        <a href="/" aria-label="MotoDoc home" className="md-brand-link mr-auto flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087658]">
          <Image src={logoSrc} alt="" width={42} height={32} className="h-8 w-[42px] object-contain" priority />
          <span className="text-[24px] font-semibold tracking-[-0.05em]">MotoDoc</span>
        </a>
        {vehicles.length > 0 && <div className="relative order-3 w-full sm:order-none sm:w-[303px]">
          <label htmlFor={`${tabId}-vehicle`} className="sr-only">Select vehicle</label>
          <select id={`${tabId}-vehicle`} value={vehicle?.id ?? ''} onChange={event => setSelectedId(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-[#d3d9dd] bg-white pl-3 pr-9 text-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087658]">
            {vehicles.map(item => <option key={item.id} value={item.id}>{item.name} ({item.registration})</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-4 w-4" />
        </div>}
        <nav aria-label="Dashboard sections" className="order-4 w-full overflow-x-auto sm:order-4 lg:order-none lg:w-auto">
          <div role="tablist" aria-label="Vehicle details" className="flex gap-5">
            {tabs.map((item, index) => <button key={item} id={`${tabId}-${index}`} role="tab" aria-selected={tab === item} aria-controls={`${tabId}-panel`} tabIndex={tab === item ? 0 : -1} onKeyDown={event => handleTabKey(event, index)} onClick={() => setTab(item)} className={`whitespace-nowrap rounded py-1 text-[16px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087658] ${tab === item ? 'text-[#111827]' : 'text-[#5e646c] hover:text-[#087658]'}`}>{item}</button>)}
          </div>
        </nav>
        <button onClick={() => openDialog('profile')} aria-label="Open your account" className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087658]">
          <Initial name={account.name} size={34} />
        </button>
      </div>
    </header>

    <main className="mx-auto max-w-[1104px] px-5 pb-12 pt-7 sm:pt-[44px] min-[1180px]:px-0">
      {vehicle ? <section key={vehicle.id} aria-label="Vehicle health" {...heroPixels.handlers} className="md-health-card relative grid min-h-[354px] overflow-hidden rounded-3xl border border-[#d7dcd6] bg-white md:grid-cols-[1fr_1.12fr]">
        <PixelFill active={heroPixels.active} corner />
        <div className="relative z-10 px-7 pb-6 pt-8 sm:px-12 md:py-[59px] lg:pl-[101px] lg:pr-0">
          <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.04em] sm:text-[30px]">{vehicle.name}</h1>
          <p className="mt-1 text-[18px] leading-7 text-[#626a72]">{vehicle.registration} · {number.format(vehicle.mileage)} km</p>
          <div className="mt-[21px] grid max-w-[354px] gap-[14px]">
            <Metric label="Oil Life" value={vehicle.oilLife === null ? 'Not recorded' : `${vehicle.oilLife}%`} progress={vehicle.oilLife} />
            <Metric label="Brake Wear" value={vehicle.brakeWear === null ? 'Not recorded' : `${vehicle.brakeWear}%`} progress={vehicle.brakeWear} />
            <Metric label="MOT Countdown" value={motValue} progress={vehicle.motDays === null ? null : vehicle.motDays / 365 * 100} />
          </div>
          <button className={`${outlineButton} mt-5`} onClick={() => openDialog('condition')}><Gauge size={17} aria-hidden="true" />Update readings</button>
        </div>
        <div className="md-vehicle-art relative min-h-[240px] md:min-h-[352px]">
          {vehicle.imageSrc && vehicle.imageCredit
            ? <>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Wikimedia photo, already sized by the API */}
              <img src={vehicle.imageSrc} alt={vehicle.name} className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-14 bg-gradient-to-r from-white to-transparent md:block" />
              <a href={vehicle.imageCredit.href} target="_blank" rel="noreferrer" className="absolute bottom-2 right-3 max-w-[80%] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11px] leading-4 text-white hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white">Photo: {vehicle.imageCredit.label}</a>
            </>
            : vehicle.imageSrc
            ? vehicle.imageSrc.endsWith('.svg')
              ? <Image src={vehicle.imageSrc} alt="" fill unoptimized priority className="object-contain px-10 pb-8 md:px-14 md:py-10" />
              : <Image src={vehicle.imageSrc} alt={`${vehicle.name}, front three-quarter view`} fill priority sizes="(max-width: 767px) 90vw, 560px" className="object-contain px-4 pb-5 md:py-6 md:pl-4 md:pr-7" />
            : <div className="flex h-full min-h-[240px] items-center justify-center text-[#cfe3da]"><CarFront aria-hidden="true" size={168} strokeWidth={0.75} /></div>}
        </div>
      </section> : <section className="rounded-3xl border border-[#d7dce0] bg-white p-8">
        <h1 className="text-2xl font-semibold">Your vehicles</h1>
        <p className="mt-2 text-slate-600">No vehicles have been added to this account.</p>
        <a className={`${outlineButton} mt-5`} href={`${appHref}#vehicles`}><CarFront size={17} aria-hidden="true" />Add your first vehicle</a>
      </section>}

      {vehicle && <div key={`${tab}-${vehicle.id}`} role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tabs.indexOf(tab)}`} tabIndex={0} className="mt-6 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#087658]">
        {tab === 'Service History' && <Card title="Service History">
          {records.length ? <ul className="divide-y divide-slate-100">{records.map(record => <li key={record.id} className="flex flex-wrap justify-between gap-3 py-4"><div><h3 className="font-medium">{record.title}</h3><p className="mt-1 text-sm text-slate-600">{record.workshopName} · {number.format(record.mileage)} km</p><p className="mt-1 text-sm leading-6">{record.summary}</p><div role="group" aria-label={`Rate ${record.title}`} className="mt-2 flex items-center gap-0.5">{[1, 2, 3, 4, 5].map(value => <button key={value} disabled={busy} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} aria-pressed={record.rating === value} onClick={() => void run(() => onRateService(record.bookingId, value), 'Thanks. Your rating counts towards this garage’s verified reviews.', true)} className="rounded p-1 focus-visible:outline-2 focus-visible:outline-[#087658]"><Star size={18} aria-hidden="true" className={value <= (record.rating ?? 0) ? 'fill-[#efb460] text-[#efb460]' : 'text-slate-300 hover:text-[#efb460]'} /></button>)}<span className="ml-2 text-xs text-slate-500">{record.rating ? 'Your rating' : 'Rate this service'}</span></div></div><time dateTime={record.date} className="text-sm text-slate-600">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(record.date))}</time></li>)}</ul>
            : <Empty icon={<History aria-hidden="true" className="h-6 w-6" />} title="No completed services recorded">Completed service records for {vehicle.registration} will appear here.</Empty>}
        </Card>}

        {tab === 'Bookings' && <Card title="Bookings">
          {vehicleBookings.length ? <ul className="divide-y divide-slate-100">{vehicleBookings.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.workshop.name} · {bookingDate(item.startsAt)}</p><p className={`mt-1 text-sm ${item.status === 'confirmed' ? 'text-[#087658]' : 'text-slate-600'}`}>{statusLabel[item.status]}</p></div>
            <div className="flex flex-wrap gap-2.5">{isActive(item) && <button className={outlineButton} onClick={() => openDialog('manage', item)}><Settings size={17} aria-hidden="true" />Manage</button>}<button className={outlineButton} onClick={() => openDialog('message', item)}><MessageSquare size={17} aria-hidden="true" />Messages</button></div>
          </li>)}</ul> : <Empty icon={<CalendarDays aria-hidden="true" className="h-6 w-6" />} title="No bookings for this vehicle">Find a garage and request your first service.</Empty>}
          <div className="mt-5">{bookService}</div>
        </Card>}

        {tab === 'Overview' && <div className="grid gap-7 md:grid-cols-2">
          <Card title="Upcoming Service">
            {upcoming ? <>
              <p className="text-[19px] leading-7">{upcoming.title}</p>
              <p className="text-[16px] leading-6 text-[#626a72]">{[upcoming.workshop.name, upcoming.workshop.address].filter(Boolean).join(' · ')}</p>
              <p className="mt-3 text-[19px] leading-7">{bookingDate(upcoming.startsAt)}</p>
              {upcoming.status === 'confirmed'
                ? <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-[#087658]"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#087658]"><Check aria-hidden="true" className="h-3 w-3 text-white" strokeWidth={2.5} /></span>Confirmed</p>
                : <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-[#626a72]"><Clock3 aria-hidden="true" className="h-4 w-4" />{statusLabel.pending}</p>}
              <div className="mt-6">{bookingActions(upcoming)}</div>
            </> : <><Empty icon={<CalendarDays aria-hidden="true" className="h-6 w-6" />} title="No upcoming service">Book {vehicle.registration} in with a garage and it will appear here.</Empty><div className="mt-5">{bookService}</div></>}
          </Card>
          <Card title="Connected Workshop">
            {workshopBooking ? <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[19px] leading-7">{workshopBooking.workshop.name}</p>
                {workshopBooking.workshop.rating !== null && <span className="inline-flex items-center gap-1 rounded-full bg-[#3f4652] px-2.5 py-1 text-[12px] leading-4 text-white"><Star size={13} className="fill-[#efb460] text-[#efb460]" aria-hidden="true" /><span className="font-semibold text-[#efb460]">{workshopBooking.workshop.rating.toFixed(1)}</span><span>· {workshopBooking.workshop.reviewCount} verified {workshopBooking.workshop.reviewCount === 1 ? 'review' : 'reviews'}</span></span>}
              </div>
              {workshopBooking.workshop.address && <p className="flex items-center gap-1.5 text-[16px] leading-6 text-[#626a72]"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />{workshopBooking.workshop.address}</p>}
              {workshopBooking.workshop.mechanicName && <div className="mt-5 flex items-center gap-2"><Initial name={workshopBooking.workshop.mechanicName} size={25} /><p className="text-[15px]">{workshopBooking.workshop.mechanicName} <span className="text-[#626a72]">· Your mechanic</span></p></div>}
              {workshopBooking.workshop.openingHours && <p className="mt-2 text-[16px] text-[#626a72]">{workshopBooking.workshop.openingHours}</p>}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <button className={outlineButton} onClick={() => openDialog('message', workshopBooking)}><MessageSquare size={17} aria-hidden="true" />Message Garage</button>
                {workshopBooking.workshop.phoneNumber ? <a className={outlineButton} href={`tel:${workshopBooking.workshop.phoneNumber.replace(/[^+\d]/g, '')}`}><Phone size={17} aria-hidden="true" />Call</a> : <button className={outlineButton} onClick={() => openDialog('call', workshopBooking)}><Phone size={17} aria-hidden="true" />Call</button>}
              </div>
            </> : <><Empty icon={<Store aria-hidden="true" className="h-6 w-6" />} title="No workshop connected yet">The garage you book with will appear here, with its hours and a way to message it.</Empty><div className="mt-5">{bookService}</div></>}
          </Card>
        </div>}
      </div>}
    </main>

    <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2">
      {notice && <div className="md-toast flex items-center gap-3 rounded-xl border border-[#cde3d8] bg-white px-4 py-3 text-sm shadow-lg"><Check className="h-5 w-5 shrink-0 text-[#087658]" aria-hidden="true" /><span className="flex-1">{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')} className="rounded p-1 focus-visible:outline-2"><X size={16} /></button></div>}
    </div>

    <dialog ref={dialog} aria-labelledby={dialogTitle} onCancel={() => setDialogKind(null)} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-[#111827] shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={dialogTitle} className="text-xl font-semibold tracking-tight">{dialogKind === 'manage' ? 'Manage your service' : dialogKind === 'message' ? `Message ${target?.workshop.name ?? 'your garage'}` : dialogKind === 'call' ? `Call ${target?.workshop.name ?? 'your garage'}` : dialogKind === 'condition' ? 'Vehicle readings' : 'Your account'}</h2><button aria-label="Close dialog" onClick={closeDialog} className="rounded-full p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#087658]"><X size={20} /></button></div>

      {dialogKind === 'manage' && target && <form onSubmit={saveBooking} className="space-y-5">
        <p className="text-sm text-slate-600">{target.title} · {target.workshop.name}</p>
        <label className="block text-sm font-medium">Appointment date and time<input type="datetime-local" required step={3600} value={draftDate} onChange={event => setDraftDate(event.target.value)} className={field} /></label>
        <p className="text-xs leading-5 text-slate-500">Appointments start on the hour, in your local time. Your garage confirms any new time.</p>
        <button disabled={busy || draftDate === localInput(target.startsAt)} className={`${outlineButton} w-full`}>{busy ? 'Saving…' : 'Save new time'}</button>
        {confirmingCancel
          ? <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4 text-sm"><span className="flex-1">Cancel this booking?</span><button type="button" disabled={busy} className={outlineButton} onClick={() => setConfirmingCancel(false)}>Keep it</button><button type="button" disabled={busy} className="inline-flex min-h-10 items-center rounded-full bg-red-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700 disabled:opacity-60" onClick={() => void run(() => onCancelBooking(target.id), 'Booking cancelled.')}>Yes, cancel</button></div>
          : <button type="button" className="w-full rounded py-1 text-sm text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-red-700" onClick={() => setConfirmingCancel(true)}>Cancel this booking</button>}
      </form>}

      {dialogKind === 'message' && target && <form onSubmit={saveMessage} className="space-y-4">
        <p className="text-sm text-slate-600">{target.title} · {bookingDate(target.startsAt)}</p>
        {thread.length ? <ul aria-label="Conversation" className="max-h-56 space-y-2 overflow-y-auto">{thread.map(item => <li key={item.id} className={`md-chat-entry max-w-[85%] rounded-xl px-3 py-2 text-sm leading-5 ${item.mine ? 'ml-auto bg-[#eaf6f0]' : 'bg-slate-100'}`}><p className="whitespace-pre-wrap break-words">{item.body}</p><p className="mt-1 text-xs text-slate-500">{item.mine ? 'You' : item.senderName} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.sentAt))}</p></li>)}</ul> : <p className="text-sm text-slate-600">No messages about this booking yet.</p>}
        <label className="block text-sm font-medium">Your message<textarea required maxLength={2000} rows={4} value={message} onChange={event => setMessage(event.target.value)} className={`${field} resize-y`} /></label>
        <button disabled={busy || !message.trim()} className={`${outlineButton} w-full`}>{busy ? 'Sending…' : 'Send message'}</button>
      </form>}

      {dialogKind === 'call' && target && <div className="space-y-4 text-sm leading-6"><p>{target.workshop.name} has not added a phone number yet.</p>{target.workshop.openingHours && <p className="flex items-center gap-2 text-slate-600"><Clock3 size={16} aria-hidden="true" />{target.workshop.openingHours}</p>}<button className={outlineButton} onClick={() => setDialogKind('message')}><MessageSquare size={17} aria-hidden="true" />Write a message</button></div>}

      {dialogKind === 'condition' && vehicle && <form key={vehicle.id} onSubmit={saveCondition} className="space-y-4">
        <p className="text-sm text-slate-600">{vehicle.name} · {vehicle.registration}. Enter what your car or last inspection shows; leave a field empty if you do not know it.</p>
        <label className="block text-sm font-medium">Oil life (%)<input name="oilLife" type="number" inputMode="numeric" min={0} max={100} step={1} defaultValue={vehicle.oilLife ?? ''} className={field} /></label>
        <label className="block text-sm font-medium">Brake wear (%)<input name="brakeWear" type="number" inputMode="numeric" min={0} max={100} step={1} defaultValue={vehicle.brakeWear ?? ''} className={field} /></label>
        <label className="block text-sm font-medium">MOT due date<input name="motDue" type="date" defaultValue={vehicle.motDue ?? ''} className={field} /></label>
        <button disabled={busy} className={`${outlineButton} w-full`}>{busy ? 'Saving…' : 'Save readings'}</button>
      </form>}

      {dialogKind === 'profile' && <div className="space-y-5">
        <div className="flex items-center gap-4"><Initial name={account.name} size={56} /><div className="min-w-0"><p className="font-medium">{account.name}</p><p className="mt-1 truncate text-sm text-slate-600">{account.email}</p><p className="mt-1 text-sm text-slate-600">{vehicles.length} connected {vehicles.length === 1 ? 'vehicle' : 'vehicles'}</p></div></div>
        <div className="flex flex-wrap gap-2.5"><a className={outlineButton} href={appHref}><Settings size={17} aria-hidden="true" />Vehicles, invoices &amp; account</a><button disabled={busy} className={outlineButton} onClick={() => void run(onLogOut, '')}><LogOut size={17} aria-hidden="true" />Log out</button></div>
      </div>}

      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </dialog>
  </div>;
}
