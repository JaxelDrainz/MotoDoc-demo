import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, CarIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, LockKeyIcon, StorefrontIcon } from '@phosphor-icons/react';
import './auth.css';
import { api } from './api.js';
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export function AuthPage({ mode }) {
  const signup = mode === 'signup';
  const recovery = mode === 'recovery';
  const reset = mode === 'reset';
  const [resetToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(() => {
    const err = new URLSearchParams(location.search).get('error');
    if (err === 'google_not_configured') return 'Google sign-in is not available yet. Please use email for now.';
    if (err === 'google_auth_failed') return 'Google sign-in could not be completed. Please try again or use your password.';
    return '';
  });
  const [message, setMessage] = useState('');
  const [local, setLocal] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [role, setRole] = useState(new URLSearchParams(location.search).get('role') === 'garage' ? 'garage' : 'driver');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const form = useRef(null);
  const feedback = useRef(null);
  const googleButton = useRef(null);
  useEffect(() => { document.title = `${signup ? 'Create your account' : recovery || reset ? 'Reset your password' : 'Log in'} — MotoDoc`; }, [signup, recovery, reset]);
  useEffect(() => { if (submitted) feedback.current?.focus(); }, [submitted]);
  useEffect(() => {
    api('/config').then(config => {
      setLocal(config.local);
      if (config.googleClientId) setGoogleClientId(config.googleClientId);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!googleClientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              setBusy(true);
              setServerError('');
              await api('/auth/google', {
                method: 'POST',
                body: { credential: response.credential, role }
              });
              window.location.assign('/app');
            } catch (err) {
              setServerError(err.message);
            } finally {
              setBusy(false);
            }
          }
        });
        if (googleButton.current) {
          googleButton.current.replaceChildren();
          window.google.accounts.id.renderButton(googleButton.current,{theme:'outline',size:'large',text:signup?'signup_with':'continue_with',shape:'rectangular',width:320});
        }
      }
    };
    document.head.appendChild(script);
    return () => {
      try { document.head.removeChild(script); } catch {}
    };
  }, [googleClientId, role]);
  const handleGoogleAuth = () => setServerError('Google sign-in is not available yet. Please use email for now.');
  const change = event => {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setSubmitted(false);
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setServerError('');
    const next = {};
    if (signup && !values.name.trim()) next.name = 'Enter your full name.';
    if (!reset && !values.email.trim()) next.email = 'Enter your email address.';
    else if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (!recovery && !values.password) next.password = 'Enter your password.';
    else if ((signup || reset) && values.password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) {
      form.current.elements.namedItem(Object.keys(next)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const path = signup ? '/auth/signup' : recovery ? '/auth/forgot-password' : reset ? '/auth/reset-password' : '/auth/login';
      const body = signup ? { ...values, role } : recovery ? {email:values.email} : reset ? {password:values.password,token:resetToken} : {email:values.email,password:values.password};
      const result = await api(path,{method:'POST',body});
      setValues(current=>({...current,password:''}));
      setShowPassword(false);
      if(signup || (!recovery && !reset)) window.location.assign('/app');
      else { setMessage(result.message); setSubmitted(true); }
    } catch(error) { setServerError(error.message); }
    finally { setBusy(false); }
  };
  const title = reset ? 'Choose a new password.' : signup ? 'Create your account.' : recovery ? 'Forgot your password?' : 'Welcome back.';
  const description = reset ? 'Make it a strong one, just for your MotoDoc account.' : signup ? (role === 'garage' ? 'More time for your customers. Less time on admin.' : 'A little less admin. A lot more peace of mind.') : recovery ? 'Let’s help you get back to your car care.' : 'Your car, your garage, and everything in between.';
  return <div className={`auth-page auth-${mode}`}>
    <a className="skip-link" href="#auth-form">Skip to form</a>
    <header className="auth-header">
      <a href="/#top" className="brand" aria-label="MotoDoc home">MotoDoc</a>
      <a className="auth-home" href="/#top"><ArrowLeftIcon size={17} aria-hidden="true" /> Back to home</a>
    </header>
    <main className="auth-stage">
      <div className="auth-story">
        <span className="eyebrow">A LITTLE HELP, EVERY STEP</span>
        <h2>{signup ? (role === 'garage' ? <>Your garage.<br />In good company.</> : <>Good car care.<br />Great company.</>) : recovery ? <>A helping hand.<br />Whenever you<br className="auth-story-break" /> need it.</> : <>Your car.<br />In familiar hands.</>}</h2>
        <p>{signup ? (role === 'garage' ? 'Bring your customers, bookings, and service records together in one place.' : 'Meet your mechanic. Keep your car’s story together. Feel ready for the road ahead.') : recovery ? 'We all lose track sometimes. Getting back on the road should be simple.' : 'Pick up where you left off. Your next service and trusted mechanic are right here.'}</p>
        <span className="auth-story-signoff"><span /> Your mechanic. Your MotoDoc.</span>
      </div>
      <img className="auth-mechanic" src="/assets/mechanic-auth.png" width="1024" height="1536" alt="" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-top"><span className="auth-card-mark"><LockKeyIcon size={19} aria-hidden="true" /></span><span>MOTODOC ACCOUNT</span></div>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        <form id="auth-form" ref={form} onSubmit={submit} noValidate>
          {signup && <fieldset className="auth-roles"><legend>I’m joining as a</legend>
            {[['driver', CarIcon, 'Driver'], ['garage', StorefrontIcon, 'Garage owner']].map(([value, Icon, label]) => <label key={value} className={role === value ? 'selected' : ''}>
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
              <Icon size={21} aria-hidden="true" /><span>{label}</span>{role === value && <CheckCircleIcon size={17} weight="fill" aria-hidden="true" />}
            </label>)}
          </fieldset>}
          {(signup || (!recovery && !reset)) && <div className="auth-oauth-section">
            {googleClientId ? <div className="auth-google-provider" ref={googleButton} /> : <button type="button" className="auth-google-button" disabled={busy} onClick={handleGoogleAuth}>
              <GoogleIcon />
              <span>{signup ? (role === 'garage' ? 'Sign up as Garage with Google' : 'Sign up as Driver with Google') : 'Continue with Google'}</span>
            </button>}
            <div className="auth-divider" role="separator"><span>or continue with email</span></div>
          </div>}
          {signup && <div className="auth-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" type="text" autoComplete="name" placeholder="Your full name" value={values.name} onChange={change} required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />{errors.name && <p className="auth-error" id="name-error">{errors.name}</p>}</div>}
          {!reset && <div className="auth-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" spellCheck="false" autoCapitalize="none" placeholder="you@example.com" value={values.email} onChange={change} required aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />{errors.email && <p className="auth-error" id="email-error">{errors.email}</p>}</div>}
          {!recovery && <div className="auth-field">
            <div className="auth-label-row"><label htmlFor="auth-password">Password</label>{!signup && !reset && <a href="/forgot-password">Forgot password?</a>}</div>
            <div className="auth-password-wrap"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup || reset ? 'new-password' : 'current-password'} placeholder={signup || reset ? 'Create a password' : 'Enter your password'} value={values.password} onChange={change} required minLength={signup || reset ? 8 : undefined} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : signup || reset ? 'password-hint' : undefined} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}</button></div>
            {errors.password ? <p className="auth-error" id="password-error">{errors.password}</p> : (signup || reset) && <p className="auth-hint" id="password-hint">Use at least 8 characters.</p>}
          </div>}
          {serverError && <p className="auth-error" role="alert">{serverError}</p>}
          <button className="button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : signup ? 'Create account' : recovery ? 'Send reset link' : reset ? 'Update password' : 'Log in'}<ArrowRightIcon size={19} aria-hidden="true" /></button>
          {submitted && <div className="auth-feedback" role="status" tabIndex={-1} ref={feedback}>
            <p>{message}</p>
            {reset && <a href="/login">Back to log in <ArrowRightIcon size={16} /></a>}
          </div>}
        </form>
        <p className="auth-switch">{signup ? <>Already have an account? <a href="/login">Log in</a></> : (recovery || reset) ? <a href="/login"><ArrowLeftIcon size={15} aria-hidden="true" /> Back to log in</a> : <>New to MotoDoc? <a href="/signup">Create an account</a></>}</p>
        <div className="auth-preview-note">{local ? 'Local MotoDoc - Your account and data stay on this computer.' : 'Your car care, connected.'}</div>
      </section>
    </main>
    <footer className="auth-footer"><span>© {new Date().getFullYear()} MotoDoc</span><span>Need a hand? <a href="mailto:info@motodoc.app">Contact us <ArrowUpRightIcon size={13} aria-hidden="true" /></a></span></footer>
  </div>;
}
