import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  ClockCounterClockwiseIcon,
  ImageIcon,
  LightningIcon,
  PaletteIcon,
  PlusIcon,
  TextAaIcon,
  ToggleRightIcon,
  TrashIcon,
  TranslateIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Brand } from './Brand.jsx';
import { siteStyle } from './siteCore.js';
import { applyStyle, rememberSite, setSite } from './site.jsx';
import { toast } from './Toasts.jsx';
import './admin.css';

const tabs = [
  ['look', PaletteIcon, 'Colours & shape'],
  ['motion', LightningIcon, 'Motion'],
  ['features', ToggleRightIcon, 'Features'],
  ['content', TextAaIcon, 'Text'],
  ['translations', TranslateIcon, 'Translations'],
  ['images', ImageIcon, 'Images'],
  ['history', ClockCounterClockwiseIcon, 'History'],
];
const previews = [
  ['/', 'Home'],
  ['/login', 'Log in'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/contact', 'Contact'],
];
const colourNames = {
  primary: 'Brand green',
  primaryDark: 'Brand green, pressed',
  ink: 'Text',
  muted: 'Secondary text',
  line: 'Borders',
  surface: 'Page background',
  card: 'Card background',
  tint: 'Soft highlight',
};
const featureNames = {
  darkMode: ['Dark mode', 'Shows the light/dark switch in the signed-in areas.'],
  notifications: ['Notifications', 'The bell with new messages, booking updates and reminders.'],
  googleSignIn: ['Google sign-in', 'The “Continue with Google” button on the sign-in pages.'],
  carPhotos: ['Car photos', 'Real photos of each model; when off, body-type drawings are used.'],
  reviews: ['Ratings and reviews', 'Garage rating badges and star ratings on completed services.'],
};
const motionNames = {
  enabled: ['Animations', 'Master switch for every transition and entrance.'],
  pixelFill: ['Pixel fill', 'The pixel pattern that fills the main cards on hover.'],
  openingScreen: ['Opening screen', 'The logo screen shown once per visit to the account area.'],
  scrollReveal: ['Scroll reveal', 'Landing sections fading in as they scroll into view.'],
};
const imageNames = {
  hero: ['Home page illustration', 'Shown beside the main headline.'],
  auth: ['Sign-in illustration', 'The mechanic holding the sign-in card.'],
  drivers: ['Drivers section photo', 'Wide photo under the driver features.'],
  garages: ['Garages section photo', 'Tall photo beside the garage features.'],
  product: ['Product screenshot', 'The dashboard screenshot in the browser frame.'],
};
const sections = [
  ['hero', 'Home page header', ['title', 'tagline', 'description', 'cta', 'secondary']],
  ['drivers', 'Drivers section', ['eyebrow', 'title', 'text']],
  ['garages', 'Garages section', ['eyebrow', 'title', 'text', 'cta', 'caption']],
  ['product', 'Product screenshot section', ['eyebrow', 'title', 'text']],
  ['closing', 'Closing call to action', ['eyebrow', 'title', 'text', 'cta', 'secondary']],
];
const fieldNames = {
  title: 'Heading',
  tagline: 'Tagline',
  description: 'Description',
  text: 'Text',
  cta: 'Main button',
  secondary: 'Second link',
  eyebrow: 'Small label above the heading',
  caption: 'Caption',
};
const long = new Set(['description', 'text', 'title']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const when = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="admin-toggle">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Field({ label, value, onChange, multiline, hint }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          rows={multiline === true ? 3 : multiline}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

async function imageData(file) {
  const bitmap = await createImageBitmap(file),
    scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.75, 0.62]) {
    const data = canvas.toDataURL('image/webp', quality);
    if (data.length < 1350000) return data;
  }
  throw new Error('That image is too large even after compressing. Try a smaller one.');
}

export function Admin() {
  const [state, setState] = useState(null),
    [draft, setDraft] = useState(null),
    [assets, setAssets] = useState([]),
    [tab, setTab] = useState('look'),
    [page, setPage] = useState('/'),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(''),
    [editLang, setEditLang] = useState('en'),
    [previewLang, setPreviewLang] = useState('en'),
    [query, setQuery] = useState(''),
    [onlyEmpty, setOnlyEmpty] = useState(false),
    frame = useRef(null);

  useEffect(() => {
    document.title = 'Site settings — MotoDoc';
    api('/auth/me')
      .then(({ user }) => {
        if (!user.admin) {
          setDenied(user.email);
          return;
        }
        return Promise.all([api('/admin/site'), api('/admin/assets')]).then(([loaded, list]) => {
          setState(loaded);
          setDraft(clone(loaded.site));
          setAssets(list);
        });
      })
      .catch((e) => {
        if (e.status === 401) location.replace('/login');
        else toast(e.message, 'error');
      });
  }, []);

  const style = useMemo(() => (draft ? siteStyle(draft) : null), [draft]);
  const dirty = useMemo(
    () => !!(draft && state && JSON.stringify(draft) !== JSON.stringify(state.site)),
    [draft, state],
  );
  useEffect(() => {
    if (!style) return;
    applyStyle(style);
    frame.current?.contentWindow?.postMessage(
      { type: 'motodoc-preview', site: draft, style, lang: previewLang },
      location.origin,
    );
  }, [style, draft, previewLang]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (path, value) =>
    setDraft((current) => {
      const next = clone(current);
      const keys = path.split('.'),
        last = keys.pop();
      keys.reduce((node, key) => node[key], next)[last] = value;
      return next;
    });
  const get = (path) => path.split('.').reduce((node, key) => node[key], draft);
  const cbase = editLang === 'fi' ? 'translations.fi.content' : 'content';
  const cdraft = draft ? get(cbase) : null;

  async function reload(message) {
    const [loaded, list] = await Promise.all([api('/admin/site'), api('/admin/assets')]);
    setState(loaded);
    setDraft(clone(loaded.site));
    setAssets(list);
    const live = await api(`/site?fresh=${Date.now()}`);
    rememberSite(live.site, live.style);
    setSite(live.site, live.style);
    if (message) toast(message);
  }
  async function save() {
    setBusy(true);
    try {
      await api('/admin/site', { method: 'PUT', body: { site: draft } });
      await reload('Saved. The live site now uses these settings.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function restore(revision) {
    if (!window.confirm(`Bring back the settings saved on ${when(revision.created_at)}?`)) return;
    setBusy(true);
    try {
      await api(`/admin/revisions/${revision.id}/restore`, { method: 'POST', body: {} });
      await reload('Earlier version restored and live.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function upload(slot, file) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await imageData(file);
      const asset = await api('/admin/assets', {
        method: 'POST',
        body: { name: file.name, image },
      });
      setAssets(await api('/admin/assets'));
      set(`images.${slot}`, asset.url);
      toast('Image uploaded. Save to make it live.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const resetSection = (key) => {
    set(key, clone(key.split('.').reduce((node, part) => node[part], state.defaults)));
    toast('Defaults restored in the draft. Save to make them live.');
  };

  if (denied)
    return (
      <main className="admin-denied">
        <Brand />
        <h1>Administrators only</h1>
        <p>
          {denied} is not a MotoDoc administrator. Ask the site owner to add this email to the
          ADMIN_EMAILS setting.
        </p>
        <a href="/app">Back to your account</a>
      </main>
    );
  if (!draft)
    return (
      <main className="admin-denied" aria-busy="true">
        <Brand />
        <p>Loading site settings…</p>
      </main>
    );

  return (
    <div className="admin">
      <header className="admin-bar">
        <Brand />
        <span className="admin-title">Site settings</span>
        <div className="admin-actions">
          {dirty && <span className="admin-dirty">Unsaved changes</span>}
          <button
            className="admin-secondary"
            disabled={!dirty || busy}
            onClick={() => setDraft(clone(state.site))}
          >
            Discard
          </button>
          <button className="admin-primary" disabled={!dirty || busy} onClick={save}>
            {busy ? 'Saving…' : 'Save and publish'}
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-tabs" aria-label="Settings sections">
          {tabs.map(([key, Icon, label]) => (
            <button
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => setTab(key)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <main className="admin-editor">
          {tab === 'look' && (
            <>
              {['light', 'dark'].map((mode) => (
                <section className="admin-card" key={mode}>
                  <div className="admin-card-head">
                    <h2>{mode === 'light' ? 'Light mode colours' : 'Dark mode colours'}</h2>
                    <button className="admin-link" onClick={() => resetSection(`theme.${mode}`)}>
                      Reset
                    </button>
                  </div>
                  <div className="admin-colours">
                    {Object.keys(draft.theme[mode]).map((key) => (
                      <label key={key} className="admin-colour">
                        <input
                          type="color"
                          value={draft.theme[mode][key]}
                          onChange={(e) => set(`theme.${mode}.${key}`, e.target.value)}
                        />
                        <span>
                          <strong>{colourNames[key]}</strong>
                          <input
                            value={draft.theme[mode][key]}
                            maxLength={7}
                            onChange={(e) => set(`theme.${mode}.${key}`, e.target.value)}
                            aria-label={`${colourNames[key]} hex value`}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
              <section className="admin-card">
                <div className="admin-card-head">
                  <h2>Corner rounding</h2>
                  <button className="admin-link" onClick={() => resetSection('theme.radius')}>
                    Reset
                  </button>
                </div>
                {[
                  ['card', 'Cards', 32],
                  ['hero', 'Large header cards', 48],
                  ['button', 'Buttons (999 = pill)', 999],
                ].map(([key, label, max]) => (
                  <label className="admin-range" key={key}>
                    <span>
                      {label} <output>{draft.theme.radius[key]}px</output>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={max === 999 ? 40 : max}
                      value={Math.min(draft.theme.radius[key], max === 999 ? 40 : max)}
                      onChange={(e) =>
                        set(
                          `theme.radius.${key}`,
                          max === 999 && Number(e.target.value) === 40
                            ? 999
                            : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </section>
            </>
          )}

          {tab === 'motion' && (
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Motion</h2>
                <button className="admin-link" onClick={() => resetSection('motion')}>
                  Reset
                </button>
              </div>
              {Object.entries(motionNames).map(([key, [label, hint]]) => (
                <Toggle
                  key={key}
                  label={label}
                  hint={hint}
                  checked={draft.motion[key]}
                  onChange={(v) => set(`motion.${key}`, v)}
                />
              ))}
              <label className="admin-range">
                <span>
                  Speed <output>{draft.motion.speed}×</output>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={draft.motion.speed}
                  onChange={(e) => set('motion.speed', Number(e.target.value))}
                />
                <small>Below 1 is faster, above 1 is slower.</small>
              </label>
              <label className="admin-range">
                <span>
                  Entrance distance <output>{draft.motion.distance}px</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={draft.motion.distance}
                  onChange={(e) => set('motion.distance', Number(e.target.value))}
                />
              </label>
              <p className="admin-note">
                People who ask their device for reduced motion never see animations.
              </p>
            </section>
          )}

          {tab === 'features' && (
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Features</h2>
                <button className="admin-link" onClick={() => resetSection('features')}>
                  Reset
                </button>
              </div>
              {Object.entries(featureNames).map(([key, [label, hint]]) => (
                <Toggle
                  key={key}
                  label={label}
                  hint={hint}
                  checked={draft.features[key]}
                  onChange={(v) => set(`features.${key}`, v)}
                />
              ))}
            </section>
          )}

          {tab === 'content' && (
            <>
              <div className="admin-segment large" role="group" aria-label="Language being edited">
                {[
                  ['en', 'English'],
                  ['fi', 'Suomi'],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    aria-pressed={editLang === code}
                    onClick={() => {
                      setEditLang(code);
                      setPreviewLang(code);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="admin-note">
                In headings, a new line starts a new line on the page. In answers and legal pages
                you can use **bold**, [link text](/privacy), a line starting with “## ” for a
                heading, and lines starting with “- ” for a list.
              </p>
              {sections.map(([key, title, fields]) => (
                <section className="admin-card" key={key}>
                  <div className="admin-card-head">
                    <h2>{title}</h2>
                    <button className="admin-link" onClick={() => resetSection(`${cbase}.${key}`)}>
                      Reset
                    </button>
                  </div>
                  {fields.map((field) => (
                    <Field
                      key={field}
                      label={fieldNames[field]}
                      value={get(`${cbase}.${key}.${field}`)}
                      multiline={long.has(field)}
                      onChange={(v) => set(`${cbase}.${key}.${field}`, v)}
                    />
                  ))}
                  {cdraft[key].features && (
                    <div className="admin-features">
                      {cdraft[key].features.map((item, index) => (
                        <fieldset key={index}>
                          <legend>Feature {index + 1}</legend>
                          <Field
                            label="Title"
                            value={item.title}
                            onChange={(v) => set(`${cbase}.${key}.features.${index}.title`, v)}
                          />
                          <Field
                            label="Text"
                            value={item.text}
                            multiline={2}
                            onChange={(v) => set(`${cbase}.${key}.features.${index}.text`, v)}
                          />
                        </fieldset>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              <section className="admin-card">
                <div className="admin-card-head">
                  <h2>Questions (FAQ)</h2>
                  <button className="admin-link" onClick={() => resetSection('content.faq')}>
                    Reset
                  </button>
                </div>
                {cdraft.faq.map((item, index) => (
                  <fieldset key={index} className="admin-faq">
                    <legend>Question {index + 1}</legend>
                    <Field
                      label="Question"
                      value={item.question}
                      onChange={(v) => set(`${cbase}.faq.${index}.question`, v)}
                    />
                    <Field
                      label="Answer"
                      value={item.answer}
                      multiline={3}
                      onChange={(v) => set(`${cbase}.faq.${index}.answer`, v)}
                    />
                    <button
                      className="admin-link danger"
                      onClick={() =>
                        set(
                          'content.faq',
                          cdraft.faq.filter((_, other) => other !== index),
                        )
                      }
                    >
                      <TrashIcon size={15} /> Remove question
                    </button>
                  </fieldset>
                ))}
                {cdraft.faq.length < 20 && (
                  <button
                    className="admin-secondary"
                    onClick={() =>
                      set('content.faq', [
                        ...cdraft.faq,
                        { question: 'New question', answer: 'Answer' },
                      ])
                    }
                  >
                    <PlusIcon size={15} /> Add a question
                  </button>
                )}
              </section>
              {['privacy', 'terms', 'contact'].map((key) => (
                <section className="admin-card" key={key}>
                  <div className="admin-card-head">
                    <h2>{cdraft.legal[key].title} page</h2>
                    <button
                      className="admin-link"
                      onClick={() => resetSection(`${cbase}.legal.${key}`)}
                    >
                      Reset
                    </button>
                  </div>
                  <Field
                    label="Page title"
                    value={cdraft.legal[key].title}
                    onChange={(v) => set(`${cbase}.legal.${key}.title`, v)}
                  />
                  <Field
                    label="Introduction"
                    value={cdraft.legal[key].intro}
                    multiline={2}
                    onChange={(v) => set(`${cbase}.legal.${key}.intro`, v)}
                  />
                  <Field
                    label="Last updated"
                    value={cdraft.legal[key].updated}
                    hint="Leave empty to hide the date."
                    onChange={(v) => set(`${cbase}.legal.${key}.updated`, v)}
                  />
                  <Field
                    label="Page text"
                    value={cdraft.legal[key].body}
                    multiline={16}
                    onChange={(v) => set(`${cbase}.legal.${key}.body`, v)}
                  />
                </section>
              ))}
            </>
          )}

          {tab === 'translations' && (
            <>
              <section className="admin-card">
                <div className="admin-card-head">
                  <h2>Interface text in Finnish</h2>
                  <button
                    className="admin-link"
                    onClick={() => resetSection('translations.fi.strings')}
                  >
                    Reset all
                  </button>
                </div>
                <p className="admin-note">
                  Buttons, labels, messages and errors across the site and apps. The English text is
                  on the left; change the Finnish on the right. {'{x}'} stands for a name, date or
                  number filled in by the app. Leave a field empty to show the English.
                </p>
                <div className="admin-filter">
                  <input
                    type="search"
                    placeholder="Search English or Finnish…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search translations"
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyEmpty}
                      onChange={(e) => setOnlyEmpty(e.target.checked)}
                    />
                    Only untranslated
                  </label>
                </div>
                <div className="admin-strings">
                  {Object.entries(draft.translations.fi.strings)
                    .filter(
                      ([english, finnish]) =>
                        (!onlyEmpty || !finnish) &&
                        `${english} ${finnish}`.toLowerCase().includes(query.trim().toLowerCase()),
                    )
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(0, 150)
                    .map(([english, finnish]) => (
                      <label key={english} className="admin-string">
                        <span lang="en">{english}</span>
                        <textarea
                          lang="fi"
                          rows={english.length > 70 ? 3 : 1}
                          value={finnish}
                          onChange={(e) =>
                            set('translations.fi.strings', {
                              ...draft.translations.fi.strings,
                              [english]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                </div>
                <p className="admin-note">
                  Showing up to 150 matches of {Object.keys(draft.translations.fi.strings).length}.
                  Search to find a specific text.
                </p>
              </section>
              <section className="admin-card">
                <div className="admin-card-head">
                  <h2>Car-terms glossary</h2>
                  <button
                    className="admin-link"
                    onClick={() => resetSection('translations.fi.glossary')}
                  >
                    Reset
                  </button>
                </div>
                <p className="admin-note">
                  Short labels containing these words get a dotted underline; hovering or focusing
                  them shows the explanation in the visitor’s language.
                </p>
                {draft.translations.fi.glossary.map((entry, index) => (
                  <fieldset key={index}>
                    <legend>{entry.match || `Term ${index + 1}`}</legend>
                    <Field
                      label="Word to look for (English)"
                      value={entry.match}
                      onChange={(v) => set(`translations.fi.glossary.${index}.match`, v)}
                    />
                    <Field
                      label="Explanation in English"
                      value={entry.en}
                      multiline={2}
                      onChange={(v) => set(`translations.fi.glossary.${index}.en`, v)}
                    />
                    <Field
                      label="Explanation in Finnish"
                      value={entry.fi}
                      multiline={2}
                      onChange={(v) => set(`translations.fi.glossary.${index}.fi`, v)}
                    />
                    <button
                      className="admin-link danger"
                      onClick={() =>
                        set(
                          'translations.fi.glossary',
                          draft.translations.fi.glossary.filter((_, other) => other !== index),
                        )
                      }
                    >
                      <TrashIcon size={15} /> Remove term
                    </button>
                  </fieldset>
                ))}
                {draft.translations.fi.glossary.length < 40 && (
                  <button
                    className="admin-secondary"
                    onClick={() =>
                      set('translations.fi.glossary', [
                        ...draft.translations.fi.glossary,
                        { match: 'New term', en: 'Explanation', fi: 'Selitys' },
                      ])
                    }
                  >
                    <PlusIcon size={15} /> Add a term
                  </button>
                )}
              </section>
            </>
          )}

          {tab === 'images' && (
            <>
              {Object.entries(imageNames).map(([slot, [label, hint]]) => (
                <section className="admin-card admin-image" key={slot}>
                  <img src={draft.images[slot]} alt="" />
                  <div>
                    <h2>{label}</h2>
                    <p className="admin-note">{hint}</p>
                    <div className="admin-image-actions">
                      <label className="admin-secondary">
                        Upload new
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          disabled={busy}
                          onChange={(e) => {
                            upload(slot, e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {assets.length > 0 && (
                        <select
                          aria-label={`Choose an uploaded image for ${label}`}
                          value=""
                          onChange={(e) => e.target.value && set(`images.${slot}`, e.target.value)}
                        >
                          <option value="">Use an uploaded image…</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.url}>
                              {asset.name} · {when(asset.created_at)}
                            </option>
                          ))}
                        </select>
                      )}
                      {draft.images[slot] !== state.defaults.images[slot] && (
                        <button
                          className="admin-link"
                          onClick={() => set(`images.${slot}`, state.defaults.images[slot])}
                        >
                          Use the original
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              ))}
              <p className="admin-note">Images are resized to at most 1920px and stored as WebP.</p>
            </>
          )}

          {tab === 'history' && (
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Published versions</h2>
              </div>
              {state.revisions.length ? (
                <ul className="admin-history">
                  {state.revisions.map((revision, index) => (
                    <li key={revision.id}>
                      <span>
                        <strong>{when(revision.created_at)}</strong>
                        <small>
                          {revision.author || 'Unknown'}
                          {index === 0 && ' · live now'}
                        </small>
                      </span>
                      {index > 0 && (
                        <button
                          className="admin-secondary"
                          disabled={busy}
                          onClick={() => restore(revision)}
                        >
                          <ArrowCounterClockwiseIcon size={15} /> Restore
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-note">
                  Nothing has been published yet. The site uses the built-in defaults.
                </p>
              )}
            </section>
          )}
        </main>
        <aside className="admin-preview" aria-label="Live preview">
          <div className="admin-preview-bar">
            <select
              value={page}
              onChange={(e) => setPage(e.target.value)}
              aria-label="Preview page"
            >
              {previews.map(([path, label]) => (
                <option key={path} value={path}>
                  {label}
                </option>
              ))}
            </select>
            <span className="admin-segment" role="group" aria-label="Preview language">
              {['en', 'fi'].map((code) => (
                <button
                  key={code}
                  aria-pressed={previewLang === code}
                  onClick={() => setPreviewLang(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </span>
            <span>Preview of unsaved changes</span>
            <a
              href={page}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the live page in a new tab"
            >
              <ArrowSquareOutIcon size={17} />
            </a>
          </div>
          <iframe
            ref={frame}
            title="Site preview"
            src={`${page}?motodoc-preview=1&lang=${previewLang}`}
            onLoad={() =>
              frame.current?.contentWindow?.postMessage(
                { type: 'motodoc-preview', site: draft, style, lang: previewLang },
                location.origin,
              )
            }
          />
        </aside>
      </div>
    </div>
  );
}
