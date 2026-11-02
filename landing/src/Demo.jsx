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
  flash('Demo ready. Sample data resets after a day.');
  location.assign(result.redirect);
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
