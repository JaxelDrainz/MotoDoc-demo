import { useState } from 'react';
import { api } from './api.js';
import { flash, toast } from './Toasts.jsx';
import { passwordProblem } from './finland.js';
import { playChime } from './Onboarding.jsx';
import './settings.css';

function Switch({ label, description, checked, onChange, disabled }) {
  return (
    <label className="set-switch">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function AccountSettings({ user, onSaved }) {
  const garage = user.role === 'garage';
  const owner = garage && !!user.permissions?.includes('bookings');
  const [details, setDetails] = useState({
    name: user.name,
    phone: user.phone || '',
    address: user.address || '',
  });
  const [prefs, setPrefs] = useState(user.prefs);
  const [busy, setBusy] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', repeat: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const changed =
    details.name !== user.name ||
    details.phone !== (user.phone || '') ||
    details.address !== (user.address || '');
  const save = async (nextPrefs = prefs, message = 'Profile saved') => {
    setBusy('profile');
    try {
      await api('/account/settings', {
        method: 'PUT',
        body: {
          name: details.name.trim(),
          phone: details.phone.trim(),
          address: details.address.trim(),
          email_updates: nextPrefs.emailUpdates,
          email_chat: nextPrefs.emailChat,
          ...(garage ? { request_sound: nextPrefs.requestSound } : {}),
        },
      });
      toast(message);
      await onSaved();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const setPref = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save(next, 'Notification settings saved');
  };
  const problem = passwordProblem(passwords.next);
  const mismatch = passwords.repeat && passwords.repeat !== passwords.next;
  const changePassword = async (event) => {
    event.preventDefault();
    setBusy('password');
    try {
      await api('/account/password', {
        method: 'POST',
        body: { current: passwords.current, next: passwords.next },
      });
      setPasswords({ current: '', next: '', repeat: '' });
      toast('Password changed.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    setBusy('delete');
    try {
      await api('/account', { method: 'DELETE', body: {} });
      flash('Your account has been deleted.');
      location.assign('/login');
    } catch (error) {
      toast(error.message, 'error');
      setBusy('');
    }
  };
  const social = !user.hasPassword;

  return (
    <div className="set-sections">
      <section className="set-card" aria-labelledby="set-details">
        <h3 id="set-details">Your details</h3>
        <p className="set-hint">
          {garage ? 'Used by your team and on messages.' : 'Used on bookings and invoices.'}
        </p>
        <div className="set-grid">
          <label className="set-field">
            <span>Full name</span>
            <input
              value={details.name}
              autoComplete="name"
              onChange={(event) => setDetails({ ...details, name: event.target.value })}
            />
          </label>
          <label className="set-field">
            <span>Email</span>
            <input value={user.email} disabled />
            <small>This is your sign-in email.</small>
          </label>
          <label className="set-field">
            <span>Phone</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+358 40 123 4567"
              value={details.phone}
              onChange={(event) => setDetails({ ...details, phone: event.target.value })}
            />
            <small>
              {garage ? 'Shown to customers who book you.' : 'Only shared with garages you book.'}
            </small>
          </label>
          {!garage && (
            <label className="set-field">
              <span>Address</span>
              <input
                autoComplete="street-address"
                value={details.address}
                onChange={(event) => setDetails({ ...details, address: event.target.value })}
              />
            </label>
          )}
        </div>
        <button
          type="button"
          className="button button-small"
          disabled={!changed || !details.name.trim() || busy === 'profile'}
          onClick={() => save()}
        >
          {busy === 'profile' ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      <section className="set-card" aria-labelledby="set-notify">
        <h3 id="set-notify">Notifications</h3>
        <div className="set-switches">
          <Switch
            label="Email important updates"
            description={
              garage
                ? 'New requests, accepted quotes, cancellations and unanswered messages.'
                : 'Approvals, quotes, changes to your bookings and reminders.'
            }
            checked={prefs.emailUpdates}
            disabled={busy === 'profile'}
            onChange={(value) => setPref('emailUpdates', value)}
          />
          <Switch
            label="Email a copy of chat messages"
            description="Off by default to keep your inbox quiet."
            checked={prefs.emailChat}
            disabled={busy === 'profile'}
            onChange={(value) => setPref('emailChat', value)}
          />
          {owner && (
            <div className="set-sound">
              <Switch
                label="Sound for new requests"
                description="So you notice new work while the dashboard is open."
                checked={prefs.requestSound}
                disabled={busy === 'profile'}
                onChange={(value) => setPref('requestSound', value)}
              />
              <button type="button" className="set-link" onClick={playChime}>
                Test
              </button>
            </div>
          )}
          <div className="set-switch static">
            <span>
              <strong>Reply reminders</strong>
              <small>
                {garage
                  ? 'We remind you if a customer has waited 2 h for a reply.'
                  : 'We remind you if the garage has waited 24 h for a reply.'}
              </small>
            </span>
            <em>Always on</em>
          </div>
        </div>
        <p className="set-hint">
          Updates also show in the bell. A red badge means something needs your action.
        </p>
      </section>

      <section className="set-card" aria-labelledby="set-password">
        <h3 id="set-password">Password & sign-in</h3>
        <p className="set-hint">Signed in as {user.email}</p>
        {social ? (
          <p>
            {user.demo
              ? 'Demo accounts don’t have a password.'
              : 'You sign in with Google, so your password is managed there.'}
          </p>
        ) : (
          <form className="set-grid" onSubmit={changePassword}>
            <label className="set-field">
              <span>Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
              />
            </label>
            <label className="set-field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                aria-invalid={!!(passwords.next && problem)}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
              />
              <small className={passwords.next && problem ? 'set-error' : ''}>
                {passwords.next && problem
                  ? problem
                  : 'At least 8 characters, with letters and numbers.'}
              </small>
            </label>
            <label className="set-field">
              <span>Repeat new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwords.repeat}
                aria-invalid={!!mismatch}
                onChange={(event) => setPasswords({ ...passwords, repeat: event.target.value })}
              />
              {mismatch && <small className="set-error">The passwords don’t match.</small>}
            </label>
            <div className="set-actions">
              <button
                type="submit"
                className="button button-small"
                disabled={
                  busy === 'password' ||
                  !passwords.current ||
                  !passwords.next ||
                  !!problem ||
                  passwords.repeat !== passwords.next
                }
              >
                {busy === 'password' ? 'Please wait…' : 'Change password'}
              </button>
              <small>
                Forgot your current password? Log out and use “Forgot password?” on the sign-in
                page.
              </small>
            </div>
          </form>
        )}
      </section>

      <section className="set-card set-danger" aria-labelledby="set-danger">
        <h3 id="set-danger">Danger zone</h3>
        {confirmDelete ? (
          <div role="alertdialog" aria-labelledby="set-delete-title" className="set-confirm">
            <strong id="set-delete-title">Delete your account?</strong>
            <p>
              Your profile and personal details are removed for good and you are signed out
              everywhere. Bookings and invoices are kept for 6 years without your contact details,
              as Finnish accounting law requires. This can’t be undone.
            </p>
            <div className="set-actions">
              <button type="button" className="set-link" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="set-delete"
                disabled={busy === 'delete'}
                onClick={remove}
              >
                {busy === 'delete' ? 'Please wait…' : 'Delete account'}
              </button>
            </div>
          </div>
        ) : (
          <div className="set-actions">
            <p>Removes your account and personal data from MotoDoc.</p>
            <button
              type="button"
              className="set-delete outline"
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
