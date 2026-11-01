import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import './tour.css';

const driverSteps = [
  [
    'overview',
    'Your car care at a glance',
    'Deadlines, bookings and anything needing attention appear here.',
  ],
  [
    'vehicles',
    'Keep every car together',
    'Add a vehicle, update its mileage and keep its service story in one place.',
  ],
  [
    'garages',
    'Find a garage you trust',
    'Compare garages, services and availability before you book.',
  ],
  [
    'bookings',
    'Follow every appointment',
    'See requests, confirmed visits and past work without chasing messages.',
  ],
  [
    'history',
    'Your service history',
    'Completed work and recorded mileage stay attached to the right car.',
  ],
  [
    'memberships',
    'Benefits from your mechanic',
    'See available garage plans and manage your membership requests.',
  ],
  [
    'reminders',
    'A little help remembering',
    'Keep inspection, insurance and maintenance dates in view.',
  ],
  [
    'account',
    'Make MotoDoc yours',
    'Update your details, notification choices, password and account settings.',
  ],
];

const garageSteps = [
  [
    'overview',
    'Your workshop at a glance',
    'See incoming work, active customers and anything needing attention.',
  ],
  [
    'profile',
    'Your public garage profile',
    'Keep services, contact details and the information drivers see up to date.',
  ],
  [
    'bookings',
    'Manage every appointment',
    'Review requests, confirm times and keep the customer informed.',
  ],
  [
    'history',
    'Completed work',
    'Service records create a clear history for your garage and the driver.',
  ],
  [
    'customers',
    'Know your customers',
    'Find MotoDoc customers and keep private notes for your team.',
  ],
  [
    'memberships',
    'Reward regular customers',
    'Launch your plan, review requests and manage active members.',
  ],
  [
    'invoices',
    'Keep invoices organised',
    'Create records for completed work and track payment status.',
  ],
  [
    'reminders',
    'Stay ahead of follow-ups',
    'Keep customer and workshop reminders where the team can see them.',
  ],
  [
    'account',
    'Your garage settings',
    'Update your details, alerts, sign-in security and account settings.',
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
