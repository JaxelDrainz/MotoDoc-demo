import { useState } from 'react';
import {
  CarIcon,
  CarProfileIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { flash, toast } from './Toasts.jsx';
import './demo.css';

export const demoRoles = [
  ['driver', CarIcon, 'Driver demo', 'Driver'],
  ['driver-basic', CarProfileIcon, 'Driver, no membership', 'Driver, no membership'],
  ['garage', StorefrontIcon, 'Garage demo', 'Garage owner'],
  ['mechanic', WrenchIcon, 'Garage team member (mechanic)', 'Mechanic'],
  ['admin', ShieldCheckIcon, 'MotoDoc admin', 'MotoDoc admin'],
];

async function enter(persona) {
  const result = await api('/demo', { method: 'POST', body: { persona } });
  let intro = ['driver', 'driver-basic', 'garage'].includes(persona);
  try {
    const key = `motodoc-demo-intro-${persona}`;
    if (localStorage.getItem(key)) intro = false;
    else if (intro) localStorage.setItem(key, '1');
  } catch {}
  flash(
    intro
      ? 'Demo ready. First, the setup steps a new account goes through.'
      : 'Demo ready. Sample data resets after a day.',
  );
  location.assign(intro ? '/onboarding?demo=1' : result.redirect);
}

const TRY = {
  driver: 'Book in 6 steps, track a repair, chat with your mechanic, claim a Fuel Day pass.',
  'driver-basic':
    'See MotoDoc before joining: compare garage memberships and request emergency help.',
  garage: 'Approve requests, run the jobs board, invoice, manage members, the team and reviews.',
  mechanic: 'The garage as a team member sees it: only the areas the owner has shared.',
  admin: 'Verify garages, moderate reviews, send announcements and run Fuel Day.',
};

export function LandingDemo() {
  const [busy, setBusy] = useState('');
  return (
    <section className="section landing-demo" id="demo" aria-labelledby="demo-heading">
      <div className="container">
        <div className="section-heading steps-heading">
          <span className="eyebrow">TRY IT NOW</span>
          <h2 id="demo-heading">See MotoDoc from every side.</h2>
          <p>
            Open a demo account with one tap. Sample data, nothing to sign up for, and it resets
            after a day.
          </p>
        </div>
        <div className="landing-demo-grid">
          {demoRoles.map(([persona, Icon, label]) => (
            <button
              key={persona}
              type="button"
              disabled={!!busy}
              aria-busy={busy === persona}
              onClick={async () => {
                setBusy(persona);
                try {
                  await enter(persona);
                } catch (error) {
                  toast(error.message, 'error');
                  setBusy('');
                }
              }}
            >
              <Icon size={26} aria-hidden="true" />
              <strong>{busy === persona ? 'Opening…' : label}</strong>
              <span>{TRY[persona]}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DemoAccounts({ disabled }) {
  const [busy, setBusy] = useState('');
  return (
    <section className="demo-accounts" aria-labelledby="demo-accounts-title">
      <h2 id="demo-accounts-title">Try a demo account</h2>
      <p>One tap, sample data, nothing to sign up for.</p>
      <div className="demo-accounts-grid">
        {demoRoles.map(([persona, Icon, label]) => (
          <button
            key={persona}
            type="button"
            disabled={disabled || !!busy}
            aria-busy={busy === persona}
            onClick={async () => {
              setBusy(persona);
              try {
                await enter(persona);
              } catch (error) {
                toast(error.message, 'error');
                setBusy('');
              }
            }}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{busy === persona ? 'Opening…' : label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function DemoBar({ persona }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="demo-bar" role="note">
      <span className="demo-bar-badge">Demo</span>
      <p>Sample data, reset after a day.</p>
      <label>
        <span>Viewing as</span>
        <select
          value={persona}
          disabled={busy}
          onChange={async (event) => {
            setBusy(true);
            try {
              await enter(event.target.value);
            } catch (error) {
              toast(error.message, 'error');
              setBusy(false);
            }
          }}
        >
          {persona === 'staff' && <option value="staff">Invited team member</option>}
          {demoRoles.map(([key, , , short]) => (
            <option key={key} value={key}>
              {short}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
