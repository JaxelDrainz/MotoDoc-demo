'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { BASE_PATH } from '../lib/paths';
import Splash from './Splash';
import MotoDocDashboard, {
  type Booking,
  type BookingStatus,
  type Condition,
  type Message,
  type ServiceRecord,
  type Vehicle,
} from './MotoDocDashboard';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'driver' | 'garage';
  photo: string | null;
}
interface ApiVehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
  mileage: number;
  oil_life: number | null;
  brake_wear: number | null;
  mot_due: string | null;
  body: string | null;
  image_url: string | null;
  image_source?: string | null;
  image_credit?: string | null;
  image_license?: string | null;
}
interface ApiBooking {
  id: string;
  vehicle_id: string;
  garage_id: string;
  service: string;
  starts_at: string;
  status: BookingStatus;
  garage_name: string;
  garage_address: string;
  garage_city: string;
  phone: string | null;
  opening_hours: string | null;
  mechanic_name: string | null;
  garage_photo: string | null;
  rating: number | null;
  review_count: number;
}
interface ApiRecord {
  id: string;
  vehicle_id: string;
  booking_id: string;
  rating: number | null;
  service: string;
  summary: string;
  mileage: number;
  performed_at: string;
  garage_name: string;
}
interface ApiMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_name: string;
  sender_photo: string | null;
  body: string;
  created_at: string;
}
interface Data {
  account: ApiUser;
  vehicles: Vehicle[];
  bookings: Booking[];
  serviceHistory: ServiceRecord[];
  messages: Message[];
}

const APP_HREF = '/app';
const LOGIN_HREF = '/login';
const SPLASH_MS = 700;
const OPENED_KEY = 'motodoc-opened';

const vehicleImage = (v: ApiVehicle) => v.image_url ?? `/api/catalog/art/${v.body ?? 'car'}.svg`;
const imageCredit = (v: ApiVehicle) =>
  v.image_url && v.image_source
    ? { label: [v.image_credit, v.image_license].filter(Boolean).join(' · '), href: v.image_source }
    : undefined;
const daysUntil = (day: string) =>
  Math.ceil((new Date(`${day}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);

export default function ConnectedDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { user } = await api<{ user: ApiUser }>('/auth/me');
    if (user.role !== 'driver') {
      window.location.replace(APP_HREF);
      return;
    }
    const [vehicles, bookings, records, messages] = await Promise.all([
      api<ApiVehicle[]>('/vehicles'),
      api<ApiBooking[]>('/bookings'),
      api<ApiRecord[]>('/service-history'),
      api<ApiMessage[]>('/messages'),
    ]);
    setData({
      account: user,
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: `${v.make} ${v.model}`,
        registration: v.registration,
        mileage: v.mileage,
        oilLife: v.oil_life,
        brakeWear: v.brake_wear,
        motDue: v.mot_due,
        motDays: v.mot_due ? daysUntil(v.mot_due) : null,
        imageSrc: vehicleImage(v),
        imageCredit: imageCredit(v),
      })),
      bookings: bookings.map((b) => ({
        id: b.id,
        vehicleId: b.vehicle_id,
        garageId: b.garage_id,
        title: b.service,
        startsAt: b.starts_at,
        durationMinutes: 60,
        status: b.status,
        workshop: {
          name: b.garage_name,
          address: [b.garage_address, b.garage_city].filter(Boolean).join(', '),
          mechanicName: b.mechanic_name ?? '',
          photo: b.garage_photo,
          openingHours: b.opening_hours ?? '',
          phoneNumber: b.phone ?? '',
          rating: b.rating,
          reviewCount: b.review_count,
        },
      })),
      serviceHistory: records.map((r) => ({
        id: r.id,
        vehicleId: r.vehicle_id,
        bookingId: r.booking_id,
        rating: r.rating,
        title: r.service,
        summary: r.summary,
        date: r.performed_at,
        mileage: r.mileage,
        workshopName: r.garage_name,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        bookingId: m.booking_id,
        senderName: m.sender_name,
        senderPhoto: m.sender_photo,
        mine: m.sender_id === user.id,
        body: m.body,
        sentAt: m.created_at,
      })),
    });
    setError('');
  }, []);

  const open = useCallback(() => {
    load().catch((cause) => {
      if (cause instanceof ApiError && cause.status === 401) window.location.replace(LOGIN_HREF);
      else setError(cause instanceof Error ? cause.message : 'Unable to open your MotoDoc.');
    });
  }, [load]);
  useEffect(open, [open]);

  const [opening, setOpening] = useState(true);
  useEffect(() => {
    let seen = false;
    try {
      seen = !!window.sessionStorage.getItem(OPENED_KEY);
      window.sessionStorage.setItem(OPENED_KEY, '1');
    } catch {}
    const timer = window.setTimeout(() => setOpening(false), seen ? 0 : SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async (path: string, method: string, body: unknown) => {
    await api(path, { method, body });
    await load();
  };

  if (error && !data)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
        <span className="md-empty-art relative flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-[20px] bg-[#eaf6f0] text-[#087658]">
          <CircleAlert size={34} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-[19px] font-medium">MotoDoc could not open</h1>
          <p role="alert" className="mt-2 max-w-sm text-[15px] leading-6 text-[#626a72]">
            {error}
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm font-medium text-[#087658]">
          <button
            className="inline-flex min-h-10 items-center rounded-full border border-[#087658] px-4 hover:bg-[#eaf6f0]"
            onClick={() => {
              setError('');
              open();
            }}
          >
            Try again
          </button>
          <a className="underline-offset-4 hover:underline" href={LOGIN_HREF}>
            Return to login
          </a>
        </div>
      </main>
    );
  if (opening) return <Splash message="Opening your MotoDoc…" />;
  if (!data)
    return (
      <div aria-busy="true" className="min-h-screen bg-[#f4f8fa]">
        <p role="status" className="sr-only">
          Loading your MotoDoc…
        </p>
        <div className="h-[90px] border-b border-[#dce1e5] bg-white" />
        <div className="mx-auto max-w-[1104px] px-5 pt-7 sm:pt-[44px] min-[1180px]:px-0">
          <div className="md-skeleton h-[354px] rounded-3xl" />
          <div className="mt-6 grid gap-7 md:grid-cols-2">
            <div className="md-skeleton h-[250px] rounded-xl" />
            <div className="md-skeleton h-[250px] rounded-xl" />
          </div>
        </div>
      </div>
    );

  return (
    <MotoDocDashboard
      {...data}
      logoSrc={`${BASE_PATH}/images/motodoc-logo.svg`}
      appHref={APP_HREF}
      onReschedule={(id, startsAt) =>
        save(`/bookings/${id}/schedule`, 'PUT', { starts_at: startsAt })
      }
      onCancelBooking={(id) => save(`/bookings/${id}`, 'PATCH', { status: 'cancelled' })}
      onSendMessage={(id, body) => save(`/bookings/${id}/messages`, 'POST', { body })}
      onSaveCondition={(id, c: Condition) =>
        save(`/vehicles/${id}/condition`, 'PUT', {
          oil_life: c.oilLife,
          brake_wear: c.brakeWear,
          mot_due: c.motDue,
        })
      }
      onRateService={(id, rating) => save(`/bookings/${id}/review`, 'PUT', { rating })}
      onLogOut={async () => {
        await api('/auth/logout', { method: 'POST', body: {} });
        window.location.assign(LOGIN_HREF);
      }}
    />
  );
}
