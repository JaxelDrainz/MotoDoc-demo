export const VAT_RATE = 25.5;

const clampPct = (value) => Math.min(100, Math.max(0, Number(value) || 0));

export function invoiceTotals(lines, discount = { type: 'none', value: 0 }, vatRate = VAT_RATE) {
  const rows = lines.map((line) => {
    const gross = Math.round((Number(line.quantity) || 0) * (Number(line.unit_cents) || 0));
    const off = Math.round((gross * clampPct(line.discount_pct)) / 100);
    return { ...line, gross, off, total: gross - off };
  });
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const lineDiscounts = rows.reduce((sum, row) => sum + row.off, 0);
  const afterLines = gross - lineDiscounts;
  const invoiceDiscount =
    discount?.type === 'percent'
      ? Math.round((afterLines * clampPct(discount.value)) / 100)
      : discount?.type === 'amount'
        ? Math.min(Math.max(0, Math.round(Number(discount.value) || 0)), afterLines)
        : 0;
  const total = afterLines - invoiceDiscount;
  const net = Math.round(total / (1 + vatRate / 100));
  return {
    rows,
    gross,
    lineDiscounts,
    afterLines,
    invoiceDiscount,
    savings: lineDiscounts + invoiceDiscount,
    total,
    net,
    vat: total - net,
  };
}

export function referenceNumber(base) {
  const digits = String(base).replace(/\D/g, '').replace(/^0+/, '').padStart(3, '1').slice(-19);
  const weights = [7, 3, 1];
  const sum = [...digits]
    .reverse()
    .reduce((total, digit, i) => total + Number(digit) * weights[i % 3], 0);
  const full = `${digits}${(10 - (sum % 10)) % 10}`;
  return full.replace(/(\d)(?=(\d{5})+$)/g, '$1 ');
}

export const EINVOICE_ADDRESS = /^(\d{12,17}|FI\d{16})$/;
export const OPERATORS = [
  'Maventa',
  'Apix Messaging',
  'Basware',
  'Pagero',
  'OP',
  'Nordea',
  'Danske Bank',
  'Other',
];
