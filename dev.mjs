// Starts the whole MotoDoc stack: API, Next.js driver dashboard, and the landing app that fronts both.
import { spawn } from 'node:child_process';
import { connect } from 'node:net';

const servers = [
  ['API', 'landing', 'dev:api', 4174],
  ['dashboard', 'dashboard-next', 'dev', 4180],
  ['landing', 'landing', 'dev', 4173],
];
const listening = port => new Promise(done => {
  const socket = connect(port, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', () => done(false));
});

const children = [];
const stop = code => { for (const child of children) child.kill(); process.exit(code); };
for (const [name, dir, script, port] of servers) {
  // A server left running from an earlier session is reused rather than failing on its port.
  if (await listening(port)) { console.log(`[motodoc] ${name} is already running on port ${port}; reusing it.`); continue; }
  const child = spawn('npm', ['--prefix', dir, 'run', script], { stdio: 'inherit', shell: true });
  child.once('exit', code => { console.log(`[motodoc] ${name} stopped.`); stop(code ?? 1); });
  children.push(child);
}
console.log('[motodoc] Open http://localhost:4173 (driver dashboard at /dashboard).');
if (!children.length) process.exit(0);
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
