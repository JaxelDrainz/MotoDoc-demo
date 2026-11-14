import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import './tour.css';

const driverSteps = [
  [
    'overview',
    'Your car care at a glance',
    'Repairs in progress, deadlines, unpaid invoices and anything needing attention appear here.',
  ],
  [
    'bookings',
    'Book in 6 easy steps',
    'Tap Book a service: pick a garage, the service, your car and a free time on the calendar.',
  ],
  [
    'garages',
    'Find a garage you trust',
    'Filter by what’s open now or by specialisation, or tap Near me to sort by distance.',
  ],
  [
    'messages',
    'All your chats in one place',
    'Every conversation with your garages, one per booking, with quick replies.',
  ],
  [
    'mechanic',
    'Your mechanic',
    'Your garage’s contact details, prices, opening hours and your member benefits.',
  ],
  [
    'vehicles',
    'Keep every car together',
    'Add fuel type and inspection, insurance and tax dates. Open Details for each car’s history.',
  ],
  [
    'recommendations',
    'What your car needs next',
    'Oil, brakes, tyres and inspection, worked out from each car’s mileage and history.',
  ],
  [
    'memberships',
    'Benefits from your mechanic',
    'Join a garage plan and choose which of your cars it covers.',
  ],
  ['plan', 'Free or Pro', 'Pro is free while MotoDoc is new. Switch plans any time.'],
  [
    'account',
    'Make MotoDoc yours',
    'Your details, notes for your mechanic, notifications, password and account settings. Everything else is under More.',
  ],
];

const garageSteps = [
  [
    'overview',
    'Your workshop at a glance',
    'Your online switch, today’s hours, incoming work and anything needing attention.',
  ],
  [
    'profile',
    'Your public garage profile',
    'Keep services, contact details and the information drivers see up to date.',
  ],
  [
    'bookings',
    'Manage every appointment',
    'Approve requests and switch between List, Week and Month to plan the workshop.',
  ],
  [
    'jobs',
    'The jobs board',
    'Move each job from Booked to Started, Finished and Ready for pickup. Completing one offers to create the invoice.',
  ],
  ['messages', 'Every customer chat', 'One conversation per booking, with quick replies.'],
  [
    'customers',
    'Know your customers',
    'Total spent, last visit, private notes, reminders you send them and records added by hand.',
  ],
  [
    'reviews',
    'Reviews and replies',
    'Your rating breakdown, and reviews still waiting for a public reply.',
  ],
  [
    'invoices',
    'Keep invoices organised',
    'Line items, discounts, VAT, reference numbers and payment reminders.',
  ],
  ['team', 'Your team', 'Invite a manager, mechanic or receptionist and choose what each can see.'],
  [
    'account',
    'Your garage settings',
    'Your details, alerts, sign-in security and account settings. Everything else is under More.',
  ],
];

export function GuidedTour({ role, onClose, onTarget }) {
  const steps = useMemo(() => (role === 'garage' ? garageSteps : driverSteps), [role]);
  const [index, setIndex] = useState(0);
  const dialog = useRef(null);
  const [target, title, description] = steps[index];

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  useEffect(() => {
    onTarget(target);
    location.hash = target;
  }, [onTarget, target]);

  const finish = () => {
    try {
      localStorage.setItem(`motodoc-tour-${role}`, 'done');
    } catch {}
    onTarget('');
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="tour-dialog"
      aria-labelledby="tour-title"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <button type="button" className="tour-close" onClick={finish} aria-label="Close tour">
        <XIcon size={18} />
      </button>
      <div className="tour-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
        {steps.map((step, i) => (
          <span key={step[0]} className={i <= index ? 'active' : ''} />
        ))}
      </div>
      <p className="tour-count">
        <span>Step</span> {index + 1} <span>of</span> {steps.length}
      </p>
      <h2 id="tour-title">{title}</h2>
      <p className="tour-copy">{description}</p>
      <div className="tour-actions">
        {index > 0 ? (
          <button type="button" className="tour-back" onClick={() => setIndex(index - 1)}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        ) : (
          <button type="button" className="tour-back" onClick={finish}>
            Skip tour
          </button>
        )}
        <button
          type="button"
          className="button button-small"
          onClick={() => (index === steps.length - 1 ? finish() : setIndex(index + 1))}
        >
          {index === steps.length - 1 ? (
            <>
              Finish <CheckIcon size={16} />
            </>
          ) : (
            <>
              Next <ArrowRightIcon size={16} />
            </>
          )}
        </button>
      </div>
    </dialog>
  );
}
