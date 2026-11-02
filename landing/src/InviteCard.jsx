import { useEffect, useState } from 'react';
import { ArrowRightIcon, EyeIcon, EyeSlashIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { api } from './api.js';
import { flash, toast } from './Toasts.jsx';
import { passwordProblem } from './finland.js';
import { ROLES } from './team.js';

const roleName = (role) => ROLES[role]?.[0] || role;

export function InviteCard({ code }) {
  const [invite, setInvite] = useState(null),
    [gone, setGone] = useState(''),
    [values, setValues] = useState({ name: '', password: '' }),
    [terms, setTerms] = useState(false),
    [show, setShow] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/invites/${encodeURIComponent(code)}`)
      .then((i) => {
        setInvite(i);
        setValues((v) => ({ ...v, name: i.name }));
        document.title = `Join ${i.garage_name} — MotoDoc`;
      })
      .catch((e) => setGone(e.message));
  }, [code]);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const problem = !values.name.trim()
      ? 'Enter your full name.'
      : passwordProblem(values.password) ||
        (!terms && 'Please accept the terms and privacy policy to continue.');
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      const { garage_name } = await api(`/invites/${encodeURIComponent(code)}/accept`, {
        method: 'POST',
        body: { ...values, terms },
      });
      flash(`Welcome to the team at ${garage_name}`);
      location.assign('/app');
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  if (gone)
    return (
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-top">
          <span className="auth-card-mark">
            <UsersThreeIcon size={19} aria-hidden="true" />
          </span>
          <span>TEAM INVITE</span>
        </div>
        <h1 id="auth-title">This invite link doesn’t work any more</h1>
        <p className="auth-description">{gone}</p>
        <a className="button auth-submit" href="/login">
          Go to log in <ArrowRightIcon size={19} aria-hidden="true" />
        </a>
      </section>
    );
  if (!invite)
    return (
      <section className="auth-card" aria-busy="true">
        <p className="auth-description">Checking your invite…</p>
      </section>
    );
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-card-top">
        <span className="auth-card-mark">
          <UsersThreeIcon size={19} aria-hidden="true" />
        </span>
        <span>TEAM INVITE</span>
      </div>
      <h1 id="auth-title">{`Join ${invite.garage_name}`}</h1>
      <p className="auth-description">
        {`You’ve been invited as ${roleName(invite.role)}. Set a password to sign in.`}
      </p>
      <form id="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="invite-name">Full name</label>
          <input
            id="invite-name"
            autoComplete="name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="invite-email">Email address</label>
          <input id="invite-email" type="email" value={invite.email} readOnly />
        </div>
        <div className="auth-field">
          <label htmlFor="invite-password">Password</label>
          <div className="auth-password-wrap">
            <input
              id="invite-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
              value={values.password}
              onChange={(e) => setValues({ ...values, password: e.target.value })}
              required
              aria-describedby="invite-hint"
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          </div>
          <p className="auth-hint" id="invite-hint">
            At least 8 characters, with letters and numbers.
          </p>
        </div>
        <div className="auth-terms">
          <label>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              I accept the{' '}
              <a href="/terms" target="_blank" rel="noreferrer">
                terms of service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer">
                privacy policy
              </a>
              .
            </span>
          </label>
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="button auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : 'Join the team'}
          <ArrowRightIcon size={19} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
