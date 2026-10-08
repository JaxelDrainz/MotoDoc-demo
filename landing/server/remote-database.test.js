import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRemoteDatabase } from './remote-database.js';
import { createApp } from './app.js';

test('hosted database adapter persists signup and sessions across app instances', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'motodoc-hosted-'));
  const url = new URL(`file://${join(dir, 'hosted.sqlite').replaceAll('\\', '/')}`).toString();
  const database = await openRemoteDatabase({ url });
  const { app } = await createApp({ database, production:true, appOrigin:'https://motodoc.example' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await database.close();
    await rm(dir, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = 'https://motodoc.example';
  const signup = await fetch(`${base}/api/auth/signup`, {
    method:'POST',
    headers:{ Origin:origin, 'Content-Type':'application/json', 'X-MotoDoc-Request':'1' },
    body:JSON.stringify({ name:'Hosted Driver', email:'driver@hosted.example', password:'secure-test-password', role:'driver' }),
  });
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.match(signup.headers.get('set-cookie'), /Secure/);
  const me = await fetch(`${base}/api/auth/me`, { headers:{ Cookie:cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, 'driver@hosted.example');
  const reopened = await openRemoteDatabase({ url });
  assert.equal((await reopened.prepare('SELECT COUNT(*) n FROM users').get()).n, 1);
  await reopened.close();
});
