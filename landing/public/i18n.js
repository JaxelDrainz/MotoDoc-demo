(() => {
  if (window.MotoDocI18n) return;
  const LANG_KEY = 'motodoc-lang';
  const SITE_KEY = 'motodoc-site';
  const NAMES = { en: 'English', fi: 'Suomi' };
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const preview = params.has('motodoc-preview');
  if (location.pathname === '/admin') return;

  const detect = () => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved in NAMES) return saved;
    } catch {}
    return (navigator.languages || [navigator.language]).some((code) => /^fi\b/i.test(code))
      ? 'fi'
      : 'en';
  };
  let lang = preview && params.get('lang') in NAMES ? params.get('lang') : detect();
  root.lang = lang;

  const dateWords = {
    Monday: 'maanantai',
    Tuesday: 'tiistai',
    Wednesday: 'keskiviikko',
    Thursday: 'torstai',
    Friday: 'perjantai',
    Saturday: 'lauantai',
    Sunday: 'sunnuntai',
    Mon: 'ma',
    Tue: 'ti',
    Wed: 'ke',
    Thu: 'to',
    Fri: 'pe',
    Sat: 'la',
    Sun: 'su',
    January: 'tammikuuta',
    February: 'helmikuuta',
    March: 'maaliskuuta',
    April: 'huhtikuuta',
    June: 'kesäkuuta',
    July: 'heinäkuuta',
    August: 'elokuuta',
    September: 'syyskuuta',
    October: 'lokakuuta',
    November: 'marraskuuta',
    December: 'joulukuuta',
    Jan: 'tammi',
    Feb: 'helmi',
    Mar: 'maalis',
    Apr: 'huhti',
    May: 'touko',
    Jun: 'kesä',
    Jul: 'heinä',
    Aug: 'elo',
    Sep: 'syys',
    Sept: 'syys',
    Oct: 'loka',
    Nov: 'marras',
    Dec: 'joulu',
  };
  const dateWordPattern = new RegExp(`\\b(${Object.keys(dateWords).join('|')})\\b`, 'g');

  let exact = new Map(),
    patterns = [],
    glossary = [];
  function useTranslations(fi) {
    exact = new Map();
    patterns = [];
    for (const [english, finnish] of Object.entries(fi?.strings || {})) {
      if (!finnish) continue;
      if (english.includes('{x}')) {
        const source = english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{x\\}', '(.+?)');
        patterns.push([new RegExp(`^${source}$`), finnish]);
      } else exact.set(english, finnish);
    }
    glossary = (fi?.glossary || []).map((entry) => ({
      ...entry,
      test: new RegExp(
        `(^|[^A-Za-z])${entry.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`,
        'i',
      ),
    }));
  }
  function translate(text) {
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!core) return text;
    let out = exact.get(core);
    if (out === undefined)
      for (const [pattern, replacement] of patterns) {
        const match = core.match(pattern);
        if (match) {
          out = replacement.replace('{x}', exact.get(match[1]) ?? match[1]);
          break;
        }
      }
    if (out === undefined && /\d/.test(core) && dateWordPattern.test(core)) {
      dateWordPattern.lastIndex = 0;
      out = core.replace(dateWordPattern, (word) => dateWords[word]);
    }
    dateWordPattern.lastIndex = 0;
    return out === undefined ? text : lead + out + trail;
  }

  const textState = new WeakMap(),
    attrState = new WeakMap();
  const skip = (element) =>
    !element ||
    element.closest(
      'script, style, textarea, [translate="no"], .notranslate, [contenteditable="true"]',
    );
  let collecting = null;
  const mark = (element) => {
    if (collecting && element && element !== document.body) collecting.add(element);
  };
  function textNode(node) {
    if (skip(node.parentElement)) return;
    const current = node.nodeValue;
    let state = textState.get(node);
    if (!state || (current !== state.out && current !== state.src)) state = { src: current };
    const out = lang === 'fi' ? translate(state.src) : state.src;
    state.out = out;
    textState.set(node, state);
    if (current !== out) {
      node.nodeValue = out;
      mark(node.parentElement);
    }
    if (glossary.length) term(node.parentElement, state.src);
  }
  function attributes(element) {
    if (skip(element)) return;
    let states = attrState.get(element);
    if (!states) attrState.set(element, (states = {}));
    for (const name of ATTRS) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      let state = states[name];
      if (!state || (current !== state.out && current !== state.src)) state = { src: current };
      state.out = lang === 'fi' ? translate(state.src) : state.src;
      states[name] = state;
      if (current !== state.out) element.setAttribute(name, state.out);
    }
  }
  function walk(start) {
    if (start.nodeType === Node.TEXT_NODE) return textNode(start);
    if (start.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = start; node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) textNode(node);
      else {
        attributes(node);
        if (node.hasAttribute('data-lang-switch')) renderSwitch(node);
      }
    }
  }
  const nextApp = location.pathname.startsWith('/dashboard');
  const ready = () => !nextApp || root.dataset.mdReady === '1';
  const observer = new MutationObserver((records) => {
    if (!ready()) return;
    for (const record of records) {
      if (collecting) {
        if (record.type === 'characterData') mark(record.target.parentElement);
        record.addedNodes?.forEach((node) =>
          mark(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement),
        );
      }
      if (record.type === 'characterData') textNode(record.target);
      else if (record.type === 'attributes') {
        if (record.target === root && record.attributeName === 'data-md-ready') walk(document.body);
        else attributes(record.target);
      } else record.addedNodes.forEach(walk);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, 'data-md-ready'],
  });

  let tip;
  function term(element, source) {
    if (!element || source.trim().length > 40 || element.hasAttribute('data-md-term')) return;
    if (element.closest('a, button, label, select, option, input, summary, [role="tab"], dialog'))
      return;
    const index = glossary.findIndex((entry) => entry.test.test(source));
    if (index < 0) return;
    element.setAttribute('data-md-term', String(index));
    element.setAttribute('tabindex', '0');
  }
  function showTip(target) {
    const entry = glossary[Number(target.getAttribute('data-md-term'))];
    if (!entry) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'md-term-tip';
      tip.setAttribute('role', 'tooltip');
      tip.setAttribute('translate', 'no');
      document.body.append(tip);
    }
    tip.textContent = lang === 'fi' ? entry.fi : entry.en;
    target.setAttribute('aria-describedby', 'md-term-tip');
    const box = target.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(12, box.left), innerWidth - 292)}px`;
    tip.style.top = `${box.bottom + 8}px`;
    tip.hidden = false;
  }
  const hideTip = () => tip && (tip.hidden = true);
  document.addEventListener('pointerover', (event) => {
    const target = event.target.closest?.('[data-md-term]');
    if (target) showTip(target);
    else hideTip();
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target.closest?.('[data-md-term]');
    if (target) showTip(target);
    else hideTip();
  });
  document.addEventListener('keydown', (event) => event.key === 'Escape' && hideTip());
  addEventListener('scroll', hideTip, { passive: true });

  function renderSwitch(holder) {
    holder.setAttribute('translate', 'no');
    holder.setAttribute('role', 'group');
    holder.setAttribute('aria-label', lang === 'fi' ? 'Kieli' : 'Language');
    if (!holder.querySelector('button'))
      holder.replaceChildren(
        ...Object.keys(NAMES).map((code) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = code.toUpperCase();
          button.lang = code;
          button.title = NAMES[code];
          button.addEventListener('click', () => switchTo(code));
          return button;
        }),
      );
    holder
      .querySelectorAll('button')
      .forEach((button) => button.setAttribute('aria-pressed', String(button.lang === lang)));
  }

  function apply(next) {
    lang = next;
    root.lang = next;
    try {
      if (!preview) localStorage.setItem(LANG_KEY, next);
    } catch {}
    window.dispatchEvent(new CustomEvent('motodoc-lang', { detail: next }));
    walk(document.body);
    document.title = translateTitle();
    document.querySelectorAll('[data-lang-switch]').forEach(renderSwitch);
  }
  let titleSource = null;
  function translateTitle() {
    const current = document.title;
    if (titleSource === null || (current !== titleSource.out && current !== titleSource.src))
      titleSource = { src: current };
    titleSource.out = lang === 'fi' ? translate(titleSource.src) : titleSource.src;
    return titleSource.out;
  }
  const calm = () =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    root.classList.contains('md-no-motion');
  function reveal(elements) {
    const chosen = elements.filter((element) => {
      if (!element.isConnected || element.closest('[data-lang-switch]')) return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement)
        if (elements.includes(parent)) return false;
      const box = element.getBoundingClientRect();
      return (
        box.width &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        box.right > 0 &&
        box.left < innerWidth
      );
    });
    chosen.slice(0, 220).forEach((element) => {
      const box = element.getBoundingClientRect();
      const wave =
        (Math.max(0, box.left) / innerWidth +
          (1 - Math.min(innerHeight, box.bottom) / innerHeight)) /
        2;
      element.style.setProperty('--md-lang-delay', `${Math.round(wave * 220)}ms`);
      element.classList.remove('md-lang-in');
      void element.offsetWidth;
      element.classList.add('md-lang-in');
      element.addEventListener('animationend', () => element.classList.remove('md-lang-in'), {
        once: true,
      });
    });
  }
  function switchTo(next) {
    if (next === lang) return;
    if (calm()) return apply(next);
    collecting = new Set();
    apply(next);
    document.querySelectorAll('[data-lang-switch]').forEach((holder) => {
      holder.classList.remove('md-lang-pulse');
      void holder.offsetWidth;
      holder.classList.add('md-lang-pulse');
    });
    setTimeout(() => {
      const changed = [...collecting];
      collecting = null;
      reveal(changed);
    }, 140);
  }

  const style = document.createElement('style');
  style.textContent = `[data-lang-switch]{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--line,#d7dce0);border-radius:999px;background:transparent;vertical-align:middle}
[data-lang-switch] button{min-width:34px;min-height:28px;padding:0 8px;border:0;border-radius:999px;background:none;color:inherit;font:600 12px/1 Inter Variable,Inter,system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;opacity:.7}
[data-lang-switch] button[aria-pressed="true"]{background:var(--green,#087658);color:#fff;opacity:1}
[data-lang-switch] button:focus-visible{outline:3px solid #4da58b;outline-offset:2px}
[data-md-term]{text-decoration:underline dotted;text-decoration-color:currentColor;text-underline-offset:3px;cursor:help}
#md-term-tip{position:fixed;z-index:2147483645;max-width:280px;padding:10px 12px;border-radius:10px;background:#111827;color:#fff;font:400 13px/1.5 Inter Variable,Inter,system-ui,sans-serif;box-shadow:0 10px 30px #0003;pointer-events:none}
#md-term-tip[hidden]{display:none}
@keyframes md-lang-in{from{opacity:0;filter:blur(3px);transform:translateY(2px);-webkit-mask-position:100% 0;mask-position:100% 0}to{opacity:1;filter:blur(0);transform:none;-webkit-mask-position:0 0;mask-position:0 0}}
.md-lang-in{-webkit-mask-image:linear-gradient(90deg,#000 45%,transparent 55%);mask-image:linear-gradient(90deg,#000 45%,transparent 55%);-webkit-mask-size:240% 100%;mask-size:240% 100%;animation:md-lang-in 480ms cubic-bezier(.2,0,0,1) var(--md-lang-delay,0ms) both}
@keyframes md-lang-pulse{from{box-shadow:0 0 0 0 rgba(8,118,88,.35)}to{box-shadow:0 0 0 9px rgba(8,118,88,0)}}
[data-lang-switch].md-lang-pulse{animation:md-lang-pulse 600ms cubic-bezier(.2,0,0,1)}`;
  document.head.append(style);

  function fromSite(site) {
    if (site?.translations?.fi) useTranslations(site.translations.fi);
  }
  try {
    fromSite(JSON.parse(localStorage.getItem(SITE_KEY) || 'null')?.site);
  } catch {}
  addEventListener('message', (event) => {
    if (preview && event.origin === location.origin && event.data?.type === 'motodoc-preview') {
      fromSite(event.data.site);
      if (event.data.lang && event.data.lang !== lang) apply(event.data.lang);
      else if (ready()) walk(document.body);
    }
  });
  const start = () => {
    if (ready()) walk(document.body);
    document.title = translateTitle();
    if (!preview)
      fetch('/api/site', { cache: 'no-cache' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          fromSite(data.site);
          if (lang === 'fi' && ready()) walk(document.body);
        })
        .catch(() => {});
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
  new MutationObserver(() => {
    const current = document.title;
    if (titleSource && current === titleSource.out) return;
    document.title = translateTitle();
  }).observe(document.head, { subtree: true, childList: true, characterData: true });

  window.MotoDocI18n = {
    switchTo,
    get lang() {
      return lang;
    },
    translate,
  };
})();
