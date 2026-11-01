import { useEffect, useState } from 'react';
import { api } from './api.js';
import './jobs.css';

export const STAGES = [
  ['booked', 'Booked'],
  ['in_progress', 'Started'],
  ['finished', 'Finished'],
  ['ready_for_pickup', 'Ready for pickup'],
];
const STATE = {
  needs_approval: ['Needs your approval', 'Waiting for the customer', 'pending'],
  waiting: ['Waiting for garage', 'New request', 'pending'],
  confirmed: ['Confirmed', 'Approved', 'confirmed'],
  in_progress: ['In progress', 'In progress', 'confirmed'],
  finished: ['Work finished', 'Work finished', 'confirmed'],
  ready: ['Ready for pickup', 'Ready for pickup', 'completed'],
  completed: ['Completed', 'Completed', 'completed'],
  declined: ['Declined', 'Declined', 'cancelled'],
  cancelled: ['Cancelled', 'Cancelled', 'cancelled'],
  no_show: ['No-show', 'No-show', 'cancelled'],
};
const EVENTS = {
  requested: 'Request sent',
  confirmed: 'Booking approved',
  'approved-new-time': 'Approved for a new time',
  declined: 'Request declined',
  'new-time': 'New time proposed',
  scheduled: 'Scheduled by the garage',
  'customer-approved': 'Customer approved',
  'customer-declined': 'Customer declined',
  ready: 'Ready for pickup',
  note: 'Mechanic note',
  moved: 'Appointment moved',
  rescheduled: 'New time requested',
  cancelled: 'Appointment cancelled',
  'no-show': 'Marked as no-show',
  completed: 'Service completed',
  review: 'Review left',
  reply: 'Garage replied',
};
const RATING_WORDS = ['Poor', 'Below expectations', 'Okay', 'Good', 'Excellent'];
export const REVIEW_TAGS = [
  'Quality work',
  'On time',
  'Fair price',
  'Clear communication',
  'Friendly staff',
  'Clean car on return',
];

const pad = (n) => String(n).padStart(2, '0');
export const toLocalInput = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
};
const fromLocal = (value) => {
  const d = new Date(value);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
};
const nextHour = () => toLocalInput(new Date(Date.now() + 3600000).toISOString());
const when = (iso) =>
  new Intl.DateTimeFormat(document.documentElement.lang === 'fi' ? 'fi-FI' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const detailText = (detail) =>
  String(detail || '')
    .split(' · ')
    .map((part) => (/^\d{4}-\d{2}-\d{2}T/.test(part) ? when(part) : part))
    .join(' · ');

export function JobStatus({ booking, isGarage }) {
  const [driverLabel, garageLabel, kind] = STATE[booking.state] || [
    booking.status,
    booking.status,
    'pending',
  ];
  return <span className={`dash-status kind-${kind}`}>{isGarage ? garageLabel : driverLabel}</span>;
}

export function JobProgress({ booking }) {
  if (!['confirmed', 'completed'].includes(booking.status)) return null;
  const current = STAGES.findIndex(([key]) => key === booking.stage);
  return (
    <ol className="job-progress" aria-label="Repair progress">
      {STAGES.map(([key, label], i) => (
        <li
          key={key}
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

export function JobDetails({ booking, isGarage }) {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    api(`/bookings/${booking.id}/timeline`)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [booking.id]);
  const b = booking;
  return (
    <div className="job-details">
      <div className="job-hero">
        <JobStatus booking={b} isGarage={isGarage} />
        <strong>{when(b.starts_at)}</strong>
        <JobProgress booking={b} />
      </div>
      {b.state === 'needs_approval' && (
        <p className="job-banner violet">
          {isGarage
            ? 'You scheduled this. It’s booked once the customer approves it.'
            : `${b.garage_name} scheduled this for you. It’s booked once you approve it.`}
        </p>
      )}
      {b.state === 'waiting' && (
        <p className="job-banner amber">
          {isGarage
            ? 'This is still a request. Approve it before you start work. The customer is notified when you do.'
            : 'Waiting for the garage to approve. You’ll be notified when the garage approves, declines or suggests another time.'}
        </p>
      )}
      {['declined', 'cancelled', 'no_show'].includes(b.state) && (
        <p className="job-banner rose">
          {b.state === 'no_show'
            ? 'Marked as no-show'
            : b.state === 'declined'
              ? 'Request declined'
              : 'Appointment cancelled'}
          {b.cancel_reason && ` — ${b.cancel_reason}`}
        </p>
      )}
      {b.state === 'ready' && b.pickup_at && (
        <p className="job-banner green">
          {`Pickup time ${when(b.pickup_at)}`}
          {b.pickup_note && ` — ${b.pickup_note}`}
        </p>
      )}
      <dl className="job-facts">
        <div>
          <dt>{isGarage ? 'Customer' : 'Garage'}</dt>
          <dd>{isGarage ? b.driver_name : b.garage_name}</dd>
        </div>
        <div>
          <dt>Car</dt>
          <dd>
            {b.make} {b.model} · {b.registration}
          </dd>
        </div>
        <div>
          <dt>Mechanic</dt>
          <dd>{b.mechanic || 'Assigned on arrival'}</dd>
        </div>
        {b.notes && (
          <div>
            <dt>Notes</dt>
            <dd>{b.notes}</dd>
          </div>
        )}
        {b.chat_closes_at && (
          <div>
            <dt>Chat</dt>
            <dd>{b.chat_open ? `Open until ${when(b.chat_closes_at)}` : 'Closed'}</dd>
          </div>
        )}
      </dl>
      {b.review_rating && (
        <div className="job-review">
          <strong>
            {'★'.repeat(b.review_rating)}
            <span className="job-review-off">{'★'.repeat(5 - b.review_rating)}</span>{' '}
            {RATING_WORDS[b.review_rating - 1]}
          </strong>
          {b.review_tags?.length > 0 && <p>{b.review_tags.join(' · ')}</p>}
          {b.review_comment && <p>“{b.review_comment}”</p>}
          {b.review_reply && (
            <p className="job-reply">
              Reply from {b.garage_name}: {b.review_reply}
            </p>
          )}
        </div>
      )}
      {!b.review_rating && b.status === 'completed' && isGarage && (
        <p className="dash-help">Waiting for the customer to review this job.</p>
      )}
      <h3>Activity</h3>
      {events === null ? (
        <p className="dash-help">Loading…</p>
      ) : (
        <ol className="job-timeline">
          {events.map((e) => (
            <li key={e.id} className={`kind-${e.kind}`}>
              <strong>
                {e.kind === 'stage'
                  ? e.detail === 'in_progress'
                    ? 'Work started'
                    : 'Work finished'
                  : EVENTS[e.kind] || 'Booking updated'}
              </strong>
              {e.detail && e.kind !== 'stage' && <p>{detailText(e.detail)}</p>}
              <small>
                {when(e.at)} · {e.actor}
              </small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function jobActions(b, { isGarage, open, act, quick, details, rebook }) {
  const path = `/bookings/${b.id}`;
  const note = `${b.service} · ${b.registration} · ${when(b.starts_at)}`;
  const reason = (placeholder) => ({
    name: 'reason',
    label: 'Reason (optional)',
    maxLength: 300,
    placeholder,
  });
  const timeField = (label = 'New date & time') => ({
    name: 'starts_at',
    label,
    type: 'datetime-local',
    step: 3600,
    required: true,
  });
  const actions = [['Details', details, 'plain']];
  const addNote = [
    'Add note',
    () =>
      open({
        title: 'Add a job note',
        note: 'Visible to the customer. They’re notified.',
        fields: [{ name: 'note', label: 'Note', type: 'textarea', required: true, maxLength: 500 }],
        submit: 'Add note',
        save: (d) => act(`${path}/notes`, d),
      }),
  ];
  const complete = [
    'Complete & record',
    () =>
      open({
        title: 'Complete & create service record',
        note,
        values: { summary: `${b.service} for ${b.make} ${b.model}`.trim() },
        fields: [
          {
            name: 'summary',
            label: 'Description',
            type: 'textarea',
            required: true,
            maxLength: 2000,
          },
          {
            name: 'mileage',
            label: 'Mileage (km)',
            type: 'number',
            min: 1,
            max: 5000000,
            required: true,
          },
          { name: 'cost', label: 'Cost (€)', type: 'number', min: 0, step: 0.01 },
          { name: 'parts', label: 'Parts used', maxLength: 500 },
        ],
        submit: 'Complete & save record',
        save: (d) =>
          act(`${path}/complete`, {
            summary: d.summary,
            mileage: Number(d.mileage),
            ...(d.cost ? { cost: Number(d.cost) } : {}),
            parts: d.parts,
          }),
      }),
  ];
  const cancel =
    (noShow = false) =>
    () =>
      open({
        title: noShow
          ? 'Mark as no-show'
          : isGarage
            ? 'Cancel appointment'
            : 'Cancel this booking?',
        note: noShow
          ? 'Records the missed appointment on the customer’s history.'
          : isGarage
            ? note
            : 'This frees the slot and lets the garage know.',
        values: noShow ? { reason: 'Customer did not show up' } : {},
        fields: [reason(noShow ? '' : 'Add a short reason')],
        submit: noShow ? 'Mark as no-show' : isGarage ? 'Cancel appointment' : 'Cancel booking',
        save: (d) => act(`${path}/cancel`, { reason: d.reason, no_show: noShow }),
      });

  if (isGarage) {
    if (b.state === 'waiting')
      actions.push(
        [
          'Approve',
          () =>
            open({
              title: 'Approve and schedule',
              note: 'Confirm when the car comes in. If you agreed a different time with the customer, change it here.',
              values: { starts_at: toLocalInput(b.starts_at), mechanic: b.mechanic || '' },
              fields: [
                timeField('Appointment time'),
                { name: 'mechanic', label: 'Mechanic', maxLength: 80, placeholder: 'e.g. Mikko' },
              ],
              submit: 'Confirm schedule',
              save: (d) =>
                act(`${path}/approve`, { starts_at: fromLocal(d.starts_at), mechanic: d.mechanic }),
            }),
          'primary',
        ],
        [
          'New date',
          () =>
            open({
              title: 'Propose a new date',
              note: 'The customer is notified and the appointment is approved for the new time.',
              values: { starts_at: toLocalInput(b.starts_at) },
              fields: [timeField(), reason('e.g. We’re fully booked that day')],
              submit: 'Send new time',
              save: (d) =>
                act(`${path}/propose`, { starts_at: fromLocal(d.starts_at), reason: d.reason }),
            }),
        ],
        [
          'Decline',
          () =>
            open({
              title: 'Decline this request',
              note: 'Let the customer know why so they can rebook.',
              fields: [reason('e.g. no free slot that week')],
              submit: 'Decline request',
              save: (d) => act(`${path}/decline`, { reason: d.reason }),
            }),
          'danger',
        ],
      );
    if (b.state === 'needs_approval') actions.push(['Cancel', cancel(), 'danger']);
    if (b.state === 'confirmed')
      actions.push(
        [
          'Start job',
          () => quick(`${path}/stage`, { stage: 'in_progress' }, 'Job started'),
          'primary',
        ],
        [
          'Move',
          () =>
            open({
              title: 'Move appointment',
              note,
              values: { starts_at: toLocalInput(b.starts_at) },
              fields: [timeField(), reason('e.g. Mechanic is ill')],
              submit: 'Move appointment',
              save: (d) =>
                act(`${path}/move`, { starts_at: fromLocal(d.starts_at), reason: d.reason }),
            }),
        ],
        ['No-show', cancel(true)],
        ['Cancel', cancel(), 'danger'],
      );
    if (b.state === 'in_progress')
      actions.push(
        [
          'Mark finished',
          () => quick(`${path}/stage`, { stage: 'finished' }, 'Repair progress updated'),
          'primary',
        ],
        addNote,
        complete,
      );
    if (b.state === 'finished')
      actions.push(
        [
          'Ready for pickup',
          () =>
            open({
              title: 'Ready for pickup',
              note: 'Tell the customer when they can collect the car. They get the time and your note.',
              values: { pickup_at: nextHour() },
              fields: [
                {
                  name: 'pickup_at',
                  label: 'Pickup time',
                  type: 'datetime-local',
                  step: 3600,
                  required: true,
                },
                {
                  name: 'mileage',
                  label: 'Mileage (km)',
                  type: 'number',
                  min: 1,
                  max: 5000000,
                  required: true,
                  placeholder: 'Goes into the car’s service history.',
                },
                {
                  name: 'note',
                  label: 'Note for the customer',
                  type: 'textarea',
                  maxLength: 500,
                  placeholder: 'e.g. Front pads replaced. Keys at the front desk.',
                },
              ],
              submit: 'Send to customer',
              save: (d) =>
                act(`${path}/ready`, {
                  pickup_at: fromLocal(d.pickup_at),
                  mileage: Number(d.mileage),
                  note: d.note,
                }),
            }),
          'primary',
        ],
        addNote,
        complete,
      );
    if (b.review_rating && !b.review_reply)
      actions.push([
        'Reply',
        () =>
          open({
            title: 'Reply to this review',
            note: `${'★'.repeat(b.review_rating)} ${b.review_comment || ''}`,
            fields: [
              {
                name: 'reply',
                label: 'Your public reply',
                type: 'textarea',
                required: true,
                maxLength: 1000,
              },
            ],
            submit: 'Post reply',
            save: (d) => act(`${path}/review/reply`, d),
          }),
      ]);
  } else {
    if (b.state === 'needs_approval')
      actions.push(
        [
          'Approve',
          () => quick(`${path}/respond`, { accept: true }, 'Appointment approved'),
          'primary',
        ],
        [
          'Decline',
          () =>
            open({
              title: 'Decline this appointment?',
              note: `${b.garage_name} is told you declined. ${note}`,
              submit: 'Decline appointment',
              save: () => act(`${path}/respond`, { accept: false }),
            }),
          'danger',
        ],
      );
    if (['waiting', 'confirmed'].includes(b.state))
      actions.push(
        [
          'New time',
          () =>
            open({
              title: 'Request a new time',
              note: 'The garage reviews your request and confirms.',
              values: { starts_at: toLocalInput(b.starts_at) },
              fields: [timeField()],
              submit: 'Send request',
              save: (d) => act(`${path}/schedule`, { starts_at: fromLocal(d.starts_at) }, 'PUT'),
            }),
        ],
        ['Cancel', cancel(), 'danger'],
      );
    if (b.review_due)
      actions.push([
        'Rate your service',
        () =>
          open({
            title: 'Rate your service',
            note: `${b.service} · ${b.garage_name}${b.mechanic ? ` · ${b.mechanic}` : ''}`,
            fields: [
              {
                name: 'rating',
                label: 'Your rating',
                required: true,
                options: [5, 4, 3, 2, 1].map((n) => ({
                  value: String(n),
                  label: `${'★'.repeat(n)} ${RATING_WORDS[n - 1]}`,
                })),
              },
              {
                name: 'tags',
                label: 'What went well? (optional)',
                type: 'checkboxes',
                options: REVIEW_TAGS.map((t) => ({ value: t, label: t })),
              },
              {
                name: 'comment',
                label: 'Tell others about the mechanic’s work',
                type: 'textarea',
                maxLength: 1000,
              },
            ],
            submit: 'Submit review',
            save: (d) =>
              act(
                `${path}/review`,
                { rating: Number(d.rating), tags: d.tags, comment: d.comment },
                'PUT',
              ),
          }),
        'primary',
      ]);
    if (['declined', 'cancelled', 'no_show'].includes(b.state))
      actions.push(['Book again', rebook]);
  }
  return actions;
}
