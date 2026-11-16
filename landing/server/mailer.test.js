import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { emailProvider } from './mailer.js';

test('email provider: Brevo, Resend, or none', async () => {
  const calls = [];
  const fake = async (url, init) => {
    calls.push([url, init]);
    return { ok: true, status: 201 };
  };
  assert.equal(emailProvider({}, fake), null);
  assert.equal(emailProvider({ BREVO_API_KEY: 'k' }, fake), null, 'needs a sender address');

  const brevo = emailProvider(
    { BREVO_API_KEY: 'brevo-key', MAIL_FROM: 'hello@example.test' },
    fake,
  );
  assert.equal(
    await brevo({
      to: 'a@example.test',
      subject: 'Hi <there>',
      text: 'Line',
      url: 'https://x.test/a',
    }),
    true,
  );
  const [url, init] = calls.at(-1);
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(init.headers['api-key'], 'brevo-key');
  const body = JSON.parse(init.body);
  assert.deepEqual(body.sender, { email: 'hello@example.test', name: 'MotoDoc' });
  assert.deepEqual(body.to, [{ email: 'a@example.test' }]);
  assert.match(body.htmlContent, /https:\/\/x\.test\/a/);
  assert.match(body.textContent, /Line\n\nhttps:\/\/x\.test\/a/);

  const resend = emailProvider({ RESEND_API_KEY: 'r', MAIL_FROM: 'm@example.test' }, fake);
  await resend({ to: 'b@example.test', subject: 'S', text: 'T' });
  assert.equal(calls.at(-1)[0], 'https://api.resend.com/emails');
  assert.equal(calls.at(-1)[1].headers.authorization, 'Bearer r');

  const failing = emailProvider({ BREVO_API_KEY: 'k', MAIL_FROM: 'm@example.test' }, async () => ({
    ok: false,
    status: 401,
  }));
  assert.equal(await failing({ to: 'c@example.test', subject: 'S', text: 'T' }), false);
});

test('password reset and team invites are emailed when a provider is set', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'motodoc-mail-'));
  const sent = [];
  const { app, db } = await createApp({
    databasePath: join(dir, 'test.sqlite'),
    outboxPath: join(dir, 'mailbox'),
    imageLookup: async () => null,
    sendEmail: async (message) => {
      sent.push(message);
      return true;
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (path, body) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: 'http://localhost:4173',
        'X-MotoDoc-Request': '1',
        'Content-Type': 'application/json',
        cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.headers.has('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  await call('/api/auth/signup', {
    name: 'Mail Garage',
    email: 'mail-garage@example.test',
    password: 'testing-password-42',
    role: 'garage',
    terms: true,
  });
  const reset = await call('/api/auth/forgot-password', { email: 'mail-garage@example.test' });
  assert.equal(reset.status, 200);
  assert.match(reset.data.message, /emailed a reset link/);
  assert.equal(sent.at(-1).to, 'mail-garage@example.test');
  assert.match(sent.at(-1).url, /^http:\/\/localhost:4173\/reset-password#token=[0-9a-f]{64}$/);

  await call('/api/auth/forgot-password', { email: 'nobody@example.test' });
  assert.equal(sent.length, 1, 'unknown addresses get no email');

  const invite = await call('/api/team/invites', {
    name: 'Mia Mechanic',
    email: 'mia@example.test',
    role: 'mechanic',
  });
  assert.equal(invite.status, 201);
  assert.equal(invite.data.emailed, true);
  assert.equal(sent.at(-1).to, 'mia@example.test');
  assert.equal(sent.at(-1).url, `http://localhost:4173/auth?invite=${invite.data.code}`);
  const again = await call(`/api/team/invites/${invite.data.code}/resend`, {});
  assert.equal(again.data.emailed, true);
  assert.equal(sent.length, 3);
});
