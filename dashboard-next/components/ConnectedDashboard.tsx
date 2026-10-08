'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { BASE_PATH } from '../lib/paths';
import Splash from './Splash';
import MotoDocDashboard, { type Booking, type BookingStatus, type Condition, type Message, type ServiceRecord, type Vehicle } from './MotoDocDashboard';

interface ApiUser { id: string; name: string; email: string; role: 'driver' | 'garage' }
interface ApiVehicle { id: string; make: string; model: string; registration: string; mileage: number; oil_life: number | null; brake_wear: number | null; mot_due: string | null; body: string | null; image_url: string | null; image_source?: string | null; image_credit?: string | null; image_license?: string | null }
interface ApiBooking { id: string; vehicle_id: string; service: string; starts_at: string; status: BookingStatus; garage_name: string; garage_address: string; garage_city: string; phone: string | null; opening_hours: string | null; mechanic_name: string | null; rating: number | null; review_count: number }
interface ApiRecord { id: string; vehicle_id: string; booking_id: string; rating: number | null; service: string; summary: string; mileage: number; performed_at: string; garage_name: string }
interface ApiMessage { id: string; booking_id: string; sender_id: string; sender_name: string; body: string; created_at: string }
interface Data { account: ApiUser; vehicles: Vehicle[]; bookings: Booking[]; serviceHistory: ServiceRecord[]; messages: Message[] }

/** The MotoDoc account area served by the landing app on the same origin. */
const APP_HREF = '/app';
const LOGIN_HREF = '/login';
const SPLASH_MS = 1000;
// The studio shot in public/images where one exists, otherwise the model's photo found by the API, otherwise its body-type drawing.
const studioImage = (v: ApiVehicle) => /volvo/i.test(v.make) && /xc60/i.test(v.model) ? `${BASE_PATH}/images/volvo-xc60.png` : undefined;
const vehicleImage = (v: ApiVehicle) => studioImage(v) ?? v.image_url ?? `/api/catalog/art/${v.body ?? 'car'}.svg`;
const imageCredit = (v: ApiVehicle) => !studioImage(v) && v.image_url && v.image_source ? { label: [v.image_credit, v.image_license].filter(Boolean).join(' · '), href: v.image_source } : undefined;
const daysUntil = (day: string) => Math.ceil((new Date(`${day}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);

export default function ConnectedDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { user } = await api<{ user: ApiUser }>('/auth/me');
    if (user.role !== 'driver') { window.location.replace(APP_HREF); return; }
    const [vehicles, bookings, records, messages] = await Promise.all([
      api<ApiVehicle[]>('/vehicles'), api<ApiBooking[]>('/bookings'), api<ApiRecord[]>('/service-history'), api<ApiMessage[]>('/messages'),
    ]);
    setData({
      account: user,
      vehicles: vehicles.map(v => ({
        id: v.id, name: `${v.make} ${v.model}`, registration: v.registration, mileage: v.mileage,
        oilLife: v.oil_life, brakeWear: v.brake_wear, motDue: v.mot_due, motDays: v.mot_due ? daysUntil(v.mot_due) : null, imageSrc: vehicleImage(v), imageCredit: imageCredit(v),
      })),
      bookings: bookings.map(b => ({
        id: b.id, vehicleId: b.vehicle_id, title: b.service, startsAt: b.starts_at, durationMinutes: 60, status: b.status,
        workshop: { name: b.garage_name, address: [b.garage_address, b.garage_city].filter(Boolean).join(', '), mechanicName: b.mechanic_name ?? '', openingHours: b.opening_hours ?? '', phoneNumber: b.phone ?? '', rating: b.rating, reviewCount: b.review_count },
      })),
      serviceHistory: records.map(r => ({ id: r.id, vehicleId: r.vehicle_id, bookingId: r.booking_id, rating: r.rating, title: r.service, summary: r.summary, date: r.performed_at, mileage: r.mileage, workshopName: r.garage_name })),
      messages: messages.map(m => ({ id: m.id, bookingId: m.booking_id, senderName: m.sender_name, mine: m.sender_id === user.id, body: m.body, sentAt: m.created_at })),
    });
    setError('');
  }, []);

  const open = useCallback(() => {
    load().catch(cause => {
      if (cause instanceof ApiError && cause.status === 401) window.location.replace(LOGIN_HREF);
      else setError(cause instanceof Error ? cause.message : 'Unable to open your MotoDoc.');
    });
  }, [load]);
  useEffect(open, [open]);
  // Keep the opening screen up long enough for its logo animation to play once.
  const [opening, setOpening] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setOpening(false), SPLASH_MS); return () => window.clearTimeout(timer); }, []);

  const save = async (path: string, method: string, body: unknown) => { await api(path, { method, body }); await load(); };

  if (!data || opening) return <Splash message={error || 'Opening your MotoDoc…'}>
    {error && <div className="flex gap-4"><button onClick={() => { setError(''); open(); }}>Try again</button><a href={LOGIN_HREF}>Return to login</a></div>}
  </Splash>;

  return <MotoDocDashboard
    {...data}
    logoSrc={`${BASE_PATH}/images/motodoc-logo.png`}
    appHref={APP_HREF}
    onReschedule={(id, startsAt) => save(`/bookings/${id}/schedule`, 'PUT', { starts_at: startsAt })}
    onCancelBooking={id => save(`/bookings/${id}`, 'PATCH', { status: 'cancelled' })}
    onSendMessage={(id, body) => save(`/bookings/${id}/messages`, 'POST', { body })}
    onSaveCondition={(id, c: Condition) => save(`/vehicles/${id}/condition`, 'PUT', { oil_life: c.oilLife, brake_wear: c.brakeWear, mot_due: c.motDue })}
    onRateService={(id, rating) => save(`/bookings/${id}/review`, 'PUT', { rating })}
    onLogOut={async () => { await api('/auth/logout', { method: 'POST', body: {} }); window.location.assign(LOGIN_HREF); }}
  />;
}
