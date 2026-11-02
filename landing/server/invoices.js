import { z } from 'zod';
import { validBusinessId } from '../src/finland.js';
import {
  EINVOICE_ADDRESS,
  OPERATORS,
  VAT_RATE,
  invoiceTotals,
  referenceNumber,
} from '../src/invoiceMath.js';

export function registerInvoices(app, ctx) {
  const {
    one,
    all,
    run,
    db,
    transaction,
    fail,
    parse,
    id,
    clock,
    ownerGarage,
    bookingEvent,
    text,
    optional,
    dateSchema,
  } = ctx;
  const today = () => new Date(clock()).toISOString().slice(0, 10);

  const view = async (rows) => {
    const out = [];
    for (const row of rows) {
      const lines = await all(
        'SELECT description,quantity,unit_cents,discount_pct FROM invoice_lines WHERE invoice_id=? ORDER BY position',
        row.id,
      );
      const discount = { type: row.discount_type, value: row.discount_value };
      const totals = invoiceTotals(lines, discount, row.vat_rate);
      const overdueDays =
        row.status === 'unpaid' && row.due_date < today()
          ? Math.round((Date.parse(today()) - Date.parse(row.due_date)) / 86400000)
          : 0;
      out.push({
        ...row,
        lines: totals.rows,
        totals,
        reminders: JSON.parse(row.reminders || '[]'),
        state: row.status === 'unpaid' ? (overdueDays ? 'overdue' : 'unpaid') : row.status,
        overdue_days: overdueDays,
      });
    }
    return out;
  };
  const select = `SELECT i.*,g.name garage_name,g.address garage_address,g.city garage_city,gd.business_id garage_business_id,u.name driver_name,u.email driver_email,us.phone driver_phone,v.make,v.model,v.registration,b.service FROM invoices i JOIN garages g ON g.id=i.garage_id LEFT JOIN garage_details gd ON gd.garage_id=g.id JOIN users u ON u.id=i.driver_id LEFT JOIN user_settings us ON us.user_id=u.id JOIN bookings b ON b.id=i.booking_id JOIN vehicles v ON v.id=b.vehicle_id`;

  app.get('/api/invoices', async (req, res) => {
    const driver = req.user.role === 'driver';
    if (!driver) await ownerGarage(req.user);
    res.json(
      await view(
        await all(
          `${select} WHERE ${driver ? 'i.driver_id' : 'i.garage_id'}=? ORDER BY i.created_at DESC`,
          driver ? req.user.id : req.user.garage_id,
        ),
      ),
    );
  });

  const lineSchema = z.object({
    description: text(200),
    quantity: z.number().positive().max(10000).default(1),
    unit_cents: z.number().int().min(0).max(100000000),
    discount_pct: z
      .number()
      .min(0, 'A line discount must be between 0 and 100%.')
      .max(100, 'A line discount must be between 0 and 100%.')
      .default(0),
  });
  const invoiceSchema = z.object({
    booking_id: z.uuid(),
    description: text(1000).optional(),
    amount_cents: z.number().int().positive().max(100000000).optional(),
    service_description: z.string().trim().max(1000).optional(),
    mileage: z.number().int().positive().max(5000000).optional(),
    lines: z.array(lineSchema).max(50).optional(),
    discount: z
      .object({
        type: z.enum(['none', 'percent', 'amount']),
        value: z.number().min(0).default(0),
        reason: optional(60),
      })
      .default({ type: 'none', value: 0, reason: '' }),
    vat_rate: z.number().min(0).max(50).default(VAT_RATE),
    due_date: dateSchema.optional(),
    notes: optional(1000),
    business: z
      .object({
        business_id: z.string().trim().max(9),
        einvoice_address: z.string().trim().max(40),
        operator: z.enum(OPERATORS),
      })
      .optional(),
  });

  app.post('/api/invoices', async (req, res) => {
    const g = await ownerGarage(req.user);
    const d = parse(invoiceSchema, req);
    const b = await one(
      "SELECT * FROM bookings WHERE id=? AND garage_id=? AND status='completed'",
      d.booking_id,
      g.id,
    );
    if (!b) throw fail(400, 'Invoices require a completed booking at your garage.');
    if (await one('SELECT 1 FROM invoices WHERE booking_id=?', b.id))
      throw fail(409, 'This booking already has an invoice.');
    const description = (d.service_description ?? d.description ?? '').trim();
    if (description.length < 10)
      throw fail(400, 'Describe the service you did — it is required on every invoice.');
    const lines = d.lines?.length
      ? d.lines
      : d.amount_cents
        ? [{ description, quantity: 1, unit_cents: d.amount_cents, discount_pct: 0 }]
        : [];
    if (!lines.some((line) => line.unit_cents > 0))
      throw fail(400, 'Add at least one line with a price.');
    if (d.discount.type === 'percent' && d.discount.value > 100)
      throw fail(400, 'The discount can’t be more than 100%.');
    const totals = invoiceTotals(lines, d.discount, d.vat_rate);
    if (d.discount.type === 'amount' && d.discount.value > totals.afterLines)
      throw fail(400, 'The discount can’t be more than the invoice amount.');
    if (totals.total <= 0) throw fail(400, 'The invoice total must be more than €0.');
    if (d.business) {
      if (!validBusinessId(d.business.business_id))
        throw fail(400, 'Check the customer’s Business ID, for example 1234567-1.');
      if (!EINVOICE_ADDRESS.test(d.business.einvoice_address.replace(/\s/g, '')))
        throw fail(400, 'Check the e-invoice address, for example 003712345678.');
    }
    const year = today().slice(0, 4);
    const count = (
      await one(
        "SELECT COUNT(*) n FROM invoices WHERE garage_id=? AND strftime('%Y',created_at)=?",
        g.id,
        year,
      )
    ).n;
    const number = `INV-${year}-${String(Number(count) + 1).padStart(3, '0')}`;
    const due = d.due_date || new Date(clock() + 14 * 86400000).toISOString().slice(0, 10);
    const key = id();
    await transaction(db, async () => {
      await run(
        `INSERT INTO invoices(id,booking_id,garage_id,driver_id,description,amount_cents,due_date,number,reference,vat_rate,discount_type,discount_value,discount_reason,mileage,business_id,einvoice_address,operator,delivery,notes,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        key,
        b.id,
        g.id,
        b.driver_id,
        description,
        totals.total,
        due,
        number,
        referenceNumber(`${year}${String(Number(count) + 1).padStart(3, '0')}`),
        d.vat_rate,
        d.discount.type,
        Math.round(d.discount.value),
        d.discount.reason,
        d.mileage ?? null,
        d.business?.business_id || '',
        d.business?.einvoice_address.replace(/\s/g, '') || '',
        d.business?.operator || '',
        d.business ? 'einvoice' : 'motodoc',
        d.notes,
        new Date(clock()).toISOString(),
      );
      for (const [position, line] of lines.entries())
        await run(
          'INSERT INTO invoice_lines(invoice_id,position,description,quantity,unit_cents,discount_pct) VALUES(?,?,?,?,?,?)',
          key,
          position,
          line.description,
          line.quantity,
          line.unit_cents,
          line.discount_pct,
        );
      await bookingEvent(
        b.id,
        req.user.id,
        'invoice',
        `${number} · ${(totals.total / 100).toFixed(2)}`,
      );
    });
    res.status(201).json({ id: key, number });
  });

  app.patch('/api/invoices/:id', async (req, res) => {
    const g = await ownerGarage(req.user);
    const d = parse(
      z.object({ status: z.enum(['paid', 'void']), payment_reference: optional(200) }),
      req,
    );
    if (d.status === 'paid' && !d.payment_reference)
      throw fail(400, 'Enter the reference for the payment received outside MotoDoc.');
    const invoice = await one(
      "SELECT * FROM invoices WHERE id=? AND garage_id=? AND status='unpaid'",
      req.params.id,
      g.id,
    );
    if (!invoice) throw fail(404, 'Unpaid invoice not found.');
    await transaction(db, async () => {
      await run(
        'UPDATE invoices SET status=?,payment_reference=?,paid_at=?,paid_method=? WHERE id=?',
        d.status,
        d.payment_reference,
        d.status === 'paid' ? new Date(clock()).toISOString() : null,
        d.status === 'paid' ? 'bank_transfer' : null,
        invoice.id,
      );
      if (d.status === 'paid')
        await bookingEvent(invoice.booking_id, req.user.id, 'invoice-paid', invoice.number || '');
    });
    res.json({ ok: true });
  });

  app.post('/api/invoices/:id/remind', async (req, res) => {
    const g = await ownerGarage(req.user);
    const { note } = parse(z.object({ note: optional(300) }), req);
    const invoice = await one(
      "SELECT * FROM invoices WHERE id=? AND garage_id=? AND status='unpaid'",
      req.params.id,
      g.id,
    );
    if (!invoice) throw fail(404, 'Unpaid invoice not found.');
    const reminders = [...JSON.parse(invoice.reminders || '[]'), new Date(clock()).toISOString()];
    await run('UPDATE invoices SET reminders=? WHERE id=?', JSON.stringify(reminders), invoice.id);
    await bookingEvent(
      invoice.booking_id,
      req.user.id,
      'payment-reminder',
      [invoice.number, note].filter(Boolean).join(' · '),
    );
    res.json({ ok: true, reminders: reminders.length });
  });
}
