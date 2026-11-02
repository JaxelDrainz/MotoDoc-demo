import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CopyIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import { validBusinessId } from './finland.js';
import { EINVOICE_ADDRESS, OPERATORS, VAT_RATE, invoiceTotals } from './invoiceMath.js';
import './invoices.css';

const money = (cents) =>
  new Intl.NumberFormat(document.documentElement.lang === 'fi' ? 'fi-FI' : 'en-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format((cents || 0) / 100);
const day = (value) =>
  new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const STATES = {
  paid: ['Paid', 'completed'],
  overdue: ['Overdue', 'overdue'],
  unpaid: ['Unpaid', 'pending'],
  void: ['Void', 'cancelled'],
};
export function InvoiceStatus({ invoice }) {
  const [label, kind] = STATES[invoice.state] || [invoice.status, 'pending'];
  return <span className={`dash-status kind-${kind}`}>{label}</span>;
}

function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dash-dialog inv-dialog${wide ? ' wide' : ''}`}
      aria-labelledby="inv-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="Close"
        onClick={onClose}
      >
        <XIcon size={21} />
      </button>
      <h2 id="inv-title">{title}</h2>
      {children}
    </dialog>
  );
}

const blankLine = () => ({ description: '', quantity: '1', price: '', discount_pct: '' });

export function InvoiceForm({ bookings, onClose, onSaved }) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id || '');
  const booking = bookings.find((b) => b.id === bookingId);
  const [description, setDescription] = useState(
    booking ? `${booking.service} for ${booking.make} ${booking.model}.` : '',
  );
  const [mileage, setMileage] = useState('');
  const [due, setDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [lines, setLines] = useState([{ ...blankLine(), description: booking?.service || '' }]);
  const [discount, setDiscount] = useState({ type: 'none', value: '', reason: '' });
  const [business, setBusiness] = useState(null);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsedLines = lines.map((l) => ({
    description: l.description.trim(),
    quantity: Number(l.quantity) || 0,
    unit_cents: Math.round((Number(l.price) || 0) * 100),
    discount_pct: Number(l.discount_pct) || 0,
  }));
  const parsedDiscount = {
    type: discount.type,
    value:
      discount.type === 'amount'
        ? Math.round((Number(discount.value) || 0) * 100)
        : Number(discount.value) || 0,
    reason: discount.reason.trim(),
  };
  const totals = useMemo(
    () => invoiceTotals(parsedLines, parsedDiscount, VAT_RATE),
    [JSON.stringify(parsedLines), JSON.stringify(parsedDiscount)],
  );
  const setLine = (i, patch) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const problem = !booking
    ? 'Pick a completed booking to invoice.'
    : !Number(mileage)
      ? 'Add the vehicle mileage — it is required on every invoice.'
      : description.trim().length < 10
        ? 'Describe the service you did — it is required on every invoice.'
        : !parsedLines.some((l) => l.description && l.unit_cents > 0)
          ? 'Add at least one line with a price.'
          : parsedLines.some((l) => l.discount_pct < 0 || l.discount_pct > 100)
            ? 'A line discount must be between 0 and 100%.'
            : discount.type === 'percent' && parsedDiscount.value > 100
              ? 'The discount can’t be more than 100%.'
              : discount.type === 'amount' && parsedDiscount.value > totals.afterLines
                ? 'The discount can’t be more than the invoice amount.'
                : totals.total <= 0
                  ? 'The invoice total must be more than €0.'
                  : business && !validBusinessId(business.business_id)
                    ? 'Check the customer’s Business ID, for example 1234567-1.'
                    : business &&
                        !EINVOICE_ADDRESS.test(business.einvoice_address.replace(/\s/g, ''))
                      ? 'Check the e-invoice address, for example 003712345678.'
                      : '';
  const send = async () => {
    setBusy(true);
    try {
      const result = await api('/invoices', {
        method: 'POST',
        body: {
          booking_id: bookingId,
          service_description: description.trim(),
          mileage: Number(mileage),
          due_date: due,
          lines: parsedLines.filter((l) => l.description && l.unit_cents >= 0 && l.quantity > 0),
          discount: parsedDiscount,
          notes,
          ...(business ? { business } : {}),
        },
      });
      toast(`Invoice ${result.number} sent to ${booking.driver_name}`);
      await onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
      setConfirming(false);
    }
  };
  return (
    <Modal title="New invoice" onClose={onClose} wide>
      <div className="inv-form">
        <div className="inv-main">
          <h3>Customer & vehicle</h3>
          <label className="dash-field">
            Completed booking
            <select
              value={bookingId}
              onChange={(e) => {
                const next = bookings.find((b) => b.id === e.target.value);
                setBookingId(e.target.value);
                if (next) setDescription(`${next.service} for ${next.make} ${next.model}.`);
              }}
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.driver_name} · ${b.service} · ${b.registration}`}
                </option>
              ))}
            </select>
          </label>
          <div className="inv-row">
            <label className="dash-field">
              Mileage (km) <span className="required">*</span>
              <input
                type="number"
                min="1"
                value={mileage}
                placeholder="Odometer reading at the time of service."
                onChange={(e) => setMileage(e.target.value)}
              />
            </label>
            <label className="dash-field">
              Due date
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          </div>
          <label className="inv-toggle">
            <input
              type="checkbox"
              checked={!!business}
              onChange={(e) =>
                setBusiness(
                  e.target.checked
                    ? { business_id: '', einvoice_address: '', operator: OPERATORS[0] }
                    : null,
                )
              }
            />
            Business customer (send an e-invoice / verkkolasku)
          </label>
          {business && (
            <div className="inv-row three">
              <label className="dash-field">
                Business ID
                <input
                  value={business.business_id}
                  placeholder="1234567-1"
                  onChange={(e) => setBusiness({ ...business, business_id: e.target.value })}
                />
              </label>
              <label className="dash-field">
                E-invoice address
                <input
                  value={business.einvoice_address}
                  placeholder="003712345678"
                  onChange={(e) => setBusiness({ ...business, einvoice_address: e.target.value })}
                />
              </label>
              <label className="dash-field">
                Operator
                <select
                  value={business.operator}
                  onChange={(e) => setBusiness({ ...business, operator: e.target.value })}
                >
                  {OPERATORS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <h3>Work & parts</h3>
          <label className="dash-field">
            Service description <span className="required">*</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small>
              What you did, in plain words — the customer sees it on the invoice and in their
              service history.
            </small>
          </label>
          <div className="inv-lines" role="table" aria-label="Invoice lines">
            <div className="inv-line head" role="row">
              <span role="columnheader">Description</span>
              <span role="columnheader">Qty</span>
              <span role="columnheader">Price incl. VAT (€)</span>
              <span role="columnheader">% off</span>
              <span />
            </div>
            {lines.map((line, i) => (
              <div className="inv-line" role="row" key={i}>
                <input
                  aria-label="Description"
                  value={line.description}
                  placeholder="e.g. Oil change (incl. filter)"
                  onChange={(e) => setLine(i, { description: e.target.value })}
                />
                <input
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
                <input
                  aria-label="Price incl. VAT"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.price}
                  onChange={(e) => setLine(i, { price: e.target.value })}
                />
                <input
                  aria-label="Discount percent"
                  type="number"
                  min="0"
                  max="100"
                  value={line.discount_pct}
                  onChange={(e) => setLine(i, { discount_pct: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove line"
                  onClick={() =>
                    setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blankLine()]))
                  }
                >
                  <TrashIcon size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="dash-text-button"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
            >
              <PlusIcon size={15} /> Add line
            </button>
          </div>
          <div className="inv-row three">
            <label className="dash-field">
              Discount on the whole invoice
              <select
                value={discount.type}
                onChange={(e) => setDiscount({ ...discount, type: e.target.value })}
              >
                <option value="none">None</option>
                <option value="amount">Fixed amount (€)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </label>
            {discount.type !== 'none' && (
              <>
                <label className="dash-field">
                  {discount.type === 'amount' ? 'Discount amount (€)' : 'Discount (%)'}
                  <input
                    type="number"
                    min="0"
                    step={discount.type === 'amount' ? '0.01' : '1'}
                    value={discount.value}
                    onChange={(e) => setDiscount({ ...discount, value: e.target.value })}
                  />
                </label>
                <label className="dash-field">
                  Reason (shown to the customer)
                  <input
                    maxLength={60}
                    value={discount.reason}
                    list="inv-reasons"
                    onChange={(e) => setDiscount({ ...discount, reason: e.target.value })}
                  />
                  <datalist id="inv-reasons">
                    {['Loyal customer', 'Goodwill', 'Campaign', 'Price match'].map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </label>
              </>
            )}
          </div>
          <label className="dash-field">
            Notes (optional)
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <aside className="inv-summary" aria-label="Summary">
          <h3>Summary</h3>
          <dl>
            <div>
              <dt>Customer</dt>
              <dd>{booking?.driver_name || '—'}</dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>
                {booking ? `${booking.make} ${booking.model} · ${booking.registration}` : '—'}
              </dd>
            </div>
            <div>
              <dt>Mileage</dt>
              <dd>{mileage ? `${Number(mileage).toLocaleString()} km` : '—'}</dd>
            </div>
            {totals.savings > 0 && (
              <>
                <div>
                  <dt>Before discounts</dt>
                  <dd>{money(totals.gross)}</dd>
                </div>
                {totals.lineDiscounts > 0 && (
                  <div>
                    <dt>Line discounts</dt>
                    <dd>−{money(totals.lineDiscounts)}</dd>
                  </div>
                )}
                {totals.invoiceDiscount > 0 && (
                  <div>
                    <dt>{discount.reason || 'Discount'}</dt>
                    <dd>−{money(totals.invoiceDiscount)}</dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt>Total excl. VAT</dt>
              <dd>{money(totals.net)}</dd>
            </div>
            <div>
              <dt>{`VAT ${VAT_RATE}%`}</dt>
              <dd>{money(totals.vat)}</dd>
            </div>
            <div className="total">
              <dt>Total incl. VAT</dt>
              <dd>{money(totals.total)}</dd>
            </div>
          </dl>
          {problem && <p className="inv-problem">{problem}</p>}
          {confirming ? (
            <div className="inv-confirm" role="alertdialog" aria-labelledby="inv-confirm-title">
              <strong id="inv-confirm-title">{`Send the invoice to ${booking.driver_name}?`}</strong>
              <p>
                {`Total ${money(totals.total)} incl. VAT. Once sent, the invoice can’t be changed; you’d need to issue a credit note.`}
              </p>
              <button type="button" className="button button-small" disabled={busy} onClick={send}>
                {busy ? 'Sending…' : 'Send invoice'}
              </button>
              <button type="button" className="dash-secondary" onClick={() => setConfirming(false)}>
                Back
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button button-small"
              disabled={!!problem}
              onClick={() => setConfirming(true)}
            >
              Send invoice
            </button>
          )}
        </aside>
      </div>
    </Modal>
  );
}

export function InvoiceDetail({ invoice: i, isGarage, onClose, onChanged }) {
  const [mode, setMode] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (path, body, method, message) => {
    setBusy(true);
    try {
      await api(path, { method, body });
      toast(message);
      setMode('');
      await onChanged();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(i.reference.replace(/\s/g, ''));
      toast('Reference number copied');
    } catch {
      toast(`Couldn’t copy. The reference is ${i.reference}`, 'error');
    }
  };
  const t = i.totals;
  return (
    <Modal title={`Invoice ${i.number}`} onClose={onClose} wide>
      <div className="inv-detail">
        <div className="inv-head">
          <InvoiceStatus invoice={i} />
          <strong>{money(t.total)}</strong>
          <span>
            {i.state === 'paid'
              ? `Paid ${day(i.paid_at || i.created_at)}`
              : i.overdue_days
                ? `${i.overdue_days} days overdue · Due ${day(i.due_date)}`
                : `Due ${day(i.due_date)}`}
          </span>
        </div>
        {i.state === 'overdue' && (
          <p className="job-banner rose">
            {`Payment is late. ${i.reminders.length ? `${i.reminders.length} reminder(s) sent — last on ${day(i.reminders.at(-1))}.` : 'No reminder sent yet.'}`}
          </p>
        )}
        <div className="inv-parties">
          <div>
            <small>From</small>
            <strong>{i.garage_name}</strong>
            <span>{i.garage_address}</span>
            <span>{`Business ID ${i.garage_business_id || 'not added yet'}`}</span>
          </div>
          <div>
            <small>Billed to</small>
            <strong>{i.driver_name}</strong>
            {i.business_id && <span>{`Business ID ${i.business_id}`}</span>}
            {i.einvoice_address && <span>{`E-invoice ${i.einvoice_address} · ${i.operator}`}</span>}
          </div>
          <div>
            <small>Reference number</small>
            <strong className="inv-ref">
              {i.reference || '—'}
              {i.reference && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Copy reference number"
                  onClick={copy}
                >
                  <CopyIcon size={16} />
                </button>
              )}
            </strong>
            <span>{`Invoice date ${day(i.created_at)} · Due ${day(i.due_date)}`}</span>
            <span>Terms 14 days net</span>
          </div>
        </div>
        <p className="inv-vehicle">
          {`${i.make} ${i.model} · ${i.registration}${i.mileage ? ` · ${i.mileage.toLocaleString()} km at service` : ''}`}
        </p>
        <p>{i.description}</p>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Price incl. VAT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {i.lines.map((l, n) => (
              <tr key={n}>
                <td>{l.description}</td>
                <td>{l.quantity}</td>
                <td>{money(l.unit_cents)}</td>
                <td>
                  {l.off > 0 && <s>{money(l.gross)}</s>} {money(l.total)}
                  {l.off > 0 && <small>{` −${l.discount_pct}%`}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="inv-totals">
          {t.invoiceDiscount > 0 && (
            <div>
              <dt>{`${i.discount_reason || 'Discount'}${i.discount_type === 'percent' ? ` (${i.discount_value}%)` : ''}`}</dt>
              <dd>−{money(t.invoiceDiscount)}</dd>
            </div>
          )}
          {t.savings > 0 && (
            <div>
              <dt>You save</dt>
              <dd>{money(t.savings)}</dd>
            </div>
          )}
          <div>
            <dt>Total excl. VAT</dt>
            <dd>{money(t.net)}</dd>
          </div>
          <div>
            <dt>{`VAT ${i.vat_rate}%`}</dt>
            <dd>{money(t.vat)}</dd>
          </div>
          <div className="total">
            <dt>Total incl. VAT</dt>
            <dd>{money(t.total)}</dd>
          </div>
        </dl>
        {i.notes && <p className="dash-help">{i.notes}</p>}
        <ol className="inv-timeline">
          <li>{`Issued ${day(i.created_at)}`}</li>
          <li>{`Due ${day(i.due_date)}`}</li>
          {i.reminders.map((r, n) => (
            <li key={r}>{`Reminder ${n + 1} · ${day(r)}`}</li>
          ))}
          {i.state === 'paid' && (
            <li>{`Paid ${day(i.paid_at || i.created_at)}${i.paid_method === 'bank_transfer' ? ' · Bank transfer' : ''}`}</li>
          )}
        </ol>
        {!isGarage && i.state !== 'paid' && i.state !== 'void' && (
          <p className="job-banner amber">
            {`Online payments are being set up. Please pay by bank transfer using the reference number ${i.reference}.`}
          </p>
        )}
        {mode === 'remind' && (
          <div className="inv-confirm">
            <label className="dash-field">
              Extra note (optional)
              <input maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <button
              type="button"
              className="button button-small"
              disabled={busy}
              onClick={() =>
                run(
                  `/invoices/${i.id}/remind`,
                  { note: value },
                  'POST',
                  `Reminder sent to ${i.driver_name}`,
                )
              }
            >
              Send reminder
            </button>
            <button type="button" className="dash-secondary" onClick={() => setMode('')}>
              Cancel
            </button>
          </div>
        )}
        {mode === 'paid' && (
          <div className="inv-confirm">
            <strong>Mark this invoice as paid?</strong>
            <p>
              Only do this when the money has reached you outside MotoDoc, for example by bank
              transfer. The customer sees the invoice as paid.
            </p>
            <label className="dash-field">
              Payment reference
              <input maxLength={200} value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <button
              type="button"
              className="button button-small"
              disabled={busy || !value.trim()}
              onClick={() =>
                run(
                  `/invoices/${i.id}`,
                  { status: 'paid', payment_reference: value },
                  'PATCH',
                  'Marked as paid',
                )
              }
            >
              Mark as paid
            </button>
            <button type="button" className="dash-secondary" onClick={() => setMode('')}>
              Cancel
            </button>
          </div>
        )}
        <div className="dash-form-actions">
          <button type="button" className="dash-secondary" onClick={() => window.print()}>
            <PrinterIcon size={16} /> Print / save as PDF
          </button>
          {isGarage && i.status === 'unpaid' && !mode && (
            <>
              <button
                type="button"
                className="dash-secondary"
                onClick={() => {
                  setValue('');
                  setMode('remind');
                }}
              >
                Send payment reminder
              </button>
              <button
                type="button"
                className="button button-small"
                onClick={() => {
                  setValue('');
                  setMode('paid');
                }}
              >
                Mark as paid
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function InvoicesPanel({ invoices, bookings, isGarage, reload }) {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');
  const [creating, setCreating] = useState(false);
  const open = invoices.filter((i) => ['unpaid', 'overdue'].includes(i.state));
  const year = String(new Date().getFullYear());
  const tiles = isGarage
    ? [
        ['Total invoices', invoices.length],
        ['Pending', open.length],
        ['Paid', invoices.filter((i) => i.state === 'paid').length],
        ['Overdue', invoices.filter((i) => i.state === 'overdue').length],
      ]
    : [
        ['To pay', money(open.reduce((s, i) => s + i.totals.total, 0))],
        [
          'Open',
          `${open.length} open · ${invoices.filter((i) => i.state === 'overdue').length} overdue`,
        ],
        [
          'Paid this year',
          money(
            invoices
              .filter((i) => i.state === 'paid' && (i.paid_at || i.created_at).startsWith(year))
              .reduce((s, i) => s + i.totals.total, 0),
          ),
        ],
      ];
  const list = invoices
    .filter((i) => (tab === 'open' ? open.includes(i) : tab === 'paid' ? i.state === 'paid' : true))
    .filter((i) =>
      `${i.number} ${i.driver_name} ${i.garage_name} ${i.registration}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const invoiceable = bookings.filter(
    (b) => b.status === 'completed' && !invoices.some((i) => i.booking_id === b.id),
  );
  const current = invoices.find((i) => i.id === openId);
  return (
    <>
      <div className="dash-section-heading">
        <h2>{isGarage ? 'Invoicing' : 'Invoices'}</h2>
        {isGarage && (
          <button
            className="button button-small"
            disabled={!invoiceable.length}
            title={
              invoiceable.length
                ? undefined
                : 'Complete a job first. Each completed job can be invoiced once.'
            }
            onClick={() => setCreating(true)}
          >
            New invoice <PlusIcon size={16} />
          </button>
        )}
      </div>
      <div className="dash-stats">
        {tiles.map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="inv-toolbar">
        <div className="inv-tabs" role="tablist">
          {[
            ['all', 'All'],
            ['open', isGarage ? 'Pending' : 'To pay'],
            ['paid', 'Paid'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
              {key === 'open' && open.length > 0 && (
                <span className="inv-count">{open.length}</span>
              )}
            </button>
          ))}
        </div>
        {invoices.length > 6 && (
          <input
            type="search"
            className="inv-search"
            placeholder="Search invoice, name or plate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>
      {list.length ? (
        <div className="dash-list">
          {list.map((i) => (
            <button
              type="button"
              className="dash-row inv-row-button"
              key={i.id}
              onClick={() => setOpenId(i.id)}
            >
              <div className="dash-row-icon">
                <ReceiptIcon size={24} />
              </div>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>{isGarage ? i.driver_name : i.garage_name}</h3>
                  <InvoiceStatus invoice={i} />
                </div>
                <p>{`${i.number} · ${i.registration} · ${i.state === 'paid' ? `Paid ${day(i.paid_at || i.created_at)}` : `Due ${day(i.due_date)}`}`}</p>
              </div>
              <strong>{money(i.totals.total)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p className="dash-help">
          {tab === 'open'
            ? 'You’re all paid up. New invoices from your garage show up here.'
            : isGarage
              ? 'No invoices yet. Complete a job, then create its invoice here.'
              : 'No invoices yet. When a garage bills you through MotoDoc, the invoice shows up here.'}
        </p>
      )}
      {creating && (
        <InvoiceForm bookings={invoiceable} onClose={() => setCreating(false)} onSaved={reload} />
      )}
      {current && (
        <InvoiceDetail
          invoice={current}
          isGarage={isGarage}
          onClose={() => setOpenId('')}
          onChanged={reload}
        />
      )}
    </>
  );
}
