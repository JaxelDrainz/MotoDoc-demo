import { useState } from 'react';
import { CheckCircleIcon } from '@phosphor-icons/react';

const euro = (cents) =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const iso = (value) => (value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
const monthName = (value) =>
  new Date(iso(value)).toLocaleDateString('en-FI', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Helsinki',
  });
const day = (value) =>
  new Date(iso(value)).toLocaleDateString('en-FI', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Helsinki',
  });

export function HistoryPanel({ records, isGarage }) {
  const [query, setQuery] = useState(''),
    [car, setCar] = useState('');
  const cars = [...new Map(records.map((r) => [r.vehicle_id, r])).values()];
  const list = records.filter(
    (r) =>
      (!car || r.vehicle_id === car) &&
      `${r.service} ${r.summary} ${r.garage_name} ${r.registration} ${r.make || ''} ${r.model || ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const spent = list.reduce((s, r) => s + (r.cost_cents || 0), 0);
  const groups = [];
  for (const r of list) {
    const key = monthName(r.performed_at);
    const group = groups.find((g) => g.key === key);
    if (group) group.items.push(r);
    else groups.push({ key, items: [r] });
  }
  return (
    <>
      <div className="dash-stats hi-stats">
        <article>
          <p>Services</p>
          <strong>{list.length}</strong>
        </article>
        <article>
          <p>{isGarage ? 'Invoiced' : 'Total spent'}</p>
          <strong>{euro(spent)}</strong>
        </article>
      </div>
      <div className="ac-filters">
        <label className="dash-search">
          Search history
          <input
            type="search"
            placeholder="Service, garage or plate"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {cars.length > 1 && (
          <label className="dash-field ac-select">
            Car
            <select value={car} onChange={(e) => setCar(e.target.value)}>
              <option value="">All cars</option>
              {cars.map((r) => (
                <option key={r.vehicle_id} value={r.vehicle_id}>
                  {[r.make, r.model, r.registration].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {groups.length ? (
        groups.map((g) => (
          <section key={g.key}>
            <h3 className="dash-subheading">{g.key}</h3>
            <div className="dash-list">
              {g.items.map((r) => (
                <article className="dash-row" key={r.id}>
                  <div className="dash-row-icon">
                    <CheckCircleIcon size={24} />
                  </div>
                  <div className="dash-row-body">
                    <div className="dash-row-title">
                      <h3>{r.service}</h3>
                      {r.cost_cents ? <span className="mem-pill">{euro(r.cost_cents)}</span> : null}
                    </div>
                    <p>{`${r.garage_name} · ${r.registration} · ${day(r.performed_at)}`}</p>
                    <p>{r.summary}</p>
                    <small>{`${r.mileage.toLocaleString('en-FI')} km · From a completed booking`}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="dash-help">No services match.</p>
      )}
    </>
  );
}
